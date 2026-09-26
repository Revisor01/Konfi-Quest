# Audit Dokumentation gegen Code — 26.09.2026

## Umfang und Methode

Geprüft wurden alle Textquellen des Repos gegen den heutigen Code (HEAD `fce1ab01`,
Branch `claude/fervent-edison-wp5yfj`):

- `docs/handbuch/*.md` (14 Kapitel, 284 kB) — jedes Kapitel vollständig gelesen; jede
  Aussage mit Zahl, Frist, Grenze oder Rollenrecht im Backend (`backend/routes/**`,
  `backend/utils/**`, `backend/services/**`, `backend/migrations/**`) und im Frontend
  (`frontend/src/**`) nachgeschlagen.
- `docs/api/*.yaml` (5 Dateien, 580 kB) + `docs/api/ABRISS.md` — **vollständiger**
  Abgleich aller Routen per Skript (`scratchpad/dokumentation-gegen-code/routen-vergleich.mjs`):
  Mounts aus `createApp.js`, `router.<methode>('…')` aus allen 30 Routendateien
  (einschließlich der sieben Teilmodule unter `routes/events/`), direkte `app.get` in
  `createApp.js`; Pfade und Methoden normalisiert (`:id` ↔ `{id}`) und gegen alle
  `paths` der yaml-Dateien gestellt. Rollen aus `x-berechtigung.rollen` gegen die
  Middleware an der Route (`requireOrgAdmin`/`requireAdmin`/`requireTeamer`/
  `requireSuperAdmin` aus `backend/middleware/rbac.js`) verglichen; 109 maschinelle
  Treffer einzeln von Hand nachgesehen. 99 als „BEHOBEN" markierte Stellen gezählt,
  14 davon am Code nachgeprüft.
- `CHANGELOG.md` (191 kB): Abschnitt `[Unreleased] - 2.3.0` (408 Zeilen, 108 Einträge)
  und `[2.2.0]` vollständig; Abgleich gegen `git log 2.2.0..HEAD` (154 Commits, davon
  101 `feat`/`fix`) per Stichwort-Skript und Handdurchsicht.
- `README.md`, `LICENSE`, `init-scripts/README.md`, `docs/offene-befunde.md`,
  `docs/wissen/*.md`, `docs/store-texte-*.md`, `docs/bildnachweise.md`,
  `frontend/release-notes-de.txt`, `frontend/public/datenschutz.html`.
- Die drei Generatoren (`scripts/build-api-docs.mjs`, `build-openapi.mjs`,
  `build-handbuch.mjs`) gelesen und **ausgeführt**, `git status` danach verglichen,
  Erzeugnis-Änderung mit `git restore` zurückgesetzt.
- Code-Kommentare mit Datum, Messwert oder Dateiverweis: 106 datierte Messwert-
  Kommentare im Backend gezählt, 177 Dateiverweise („siehe …") maschinell auf Existenz
  geprüft, 15 Behauptungen einzeln nachgerechnet.
- Links in README/Handbuch per `curl` (11 Adressen, alle 200).

**Bewusst nicht geprüft:** die Antwortformen aller 263 dokumentierten Operationen
gegen `res.json(...)` — nur 28 Operationen tragen überhaupt ein JSON-Schema
(gemessen), der Rest beschreibt die Antwort in Prosa; zwei Stichproben stimmten (siehe
„Nicht geprüft"). `scripts/verwaiste-dateien.mjs` braucht `DATABASE_URL`; diesem
Bereich war kein Datenbank-Port zugewiesen. Screenshots gegen Produktion und die
Store-Konsolen selbst lagen außerhalb der Umgebung.

## Zusammenfassung

Der Kern hält: Alle 263 dokumentierten Operationen existieren im Code, 2 von 265
Routen fehlen in der Doku, Methoden stimmen zu 100 %, die erzeugten Dateien unter
`frontend/public/docs/` sind auf dem Stand der Quellen, alle 176 internen Handbuch-Anker
gehen ins Ziel, und die meisten konkreten Zahlen im Handbuch (Fristen, Grenzen, Regler,
Zähler — 40 Aussagen geprüft) stimmen mit dem Code überein. Die Schwächen liegen dort,
wo die Doku Rechte und Sicherheitsverhalten beschreibt: Das Handbuch verspricht eine
Bestätigungs-Mail beim Ändern der E-Mail-Adresse, die es nicht gibt; es widerspricht
sich selbst bei der Jahrgangs-Zuweisung nach einer Beförderung und bei den
Challenge-Rechten der Teamer:innen; die API-Referenz zeigt für fünf Routen Rollen, die
der Code seit Wochen nicht mehr zulässt (oder inzwischen zulässt). `ABRISS.md` führt
zwei Routen als aufruferlos, die die neue Push-Auswahl in 2.3.0 ruft. Die
README-Anleitung „Selbst betreiben" führt so nicht zu einem laufenden System, und ihre
Testzahlen sind um den Faktor 1,3–1,6 zu niedrig. Store-Texte für 2.3.0 fehlen im Repo,
während `release-notes-de.txt` sie schon trägt.

Befunde: **0 KRITISCH, 0 HOCH, 8 MITTEL, 12 NIEDRIG.**

## Release-Empfehlung für den Bereich

**mit Auflage.** Die Doku blockiert das Release nicht, aber drei Dinge müssen vor dem
Einreichen erledigt sein: (1) `docs/store-texte-2.3.0.md` anlegen und gegen
CHANGELOG und `release-notes-de.txt` lesen (BF-05); (2) die vier falschen
Handbuch-Aussagen zu Rechten und Sicherheit korrigieren (BF-02, BF-03, BF-04) und die
Generatoren laufen lassen; (3) in `docs/api/ABRISS.md` die beiden `preferences`-Routen
aus Tabelle B streichen (BF-06), damit niemand nach dem Release die Push-Auswahl
abreißt.

## Befunde

### BF-01: README „Selbst betreiben" beschreibt einen Weg, der nicht funktioniert, und nennt falsche Zahlen
- **Schwere:** MITTEL
- **Fundstelle:** `README.md:101-118` (Installation), `README.md:122-140` (Aufbau), `README.md:61`,
  `backend/server.js:16-19`, `backend/database.js:108-140`, `backend/migrations/`
  (erste Datei `064_…`), `init-scripts/README.md:53-71`
- **Kennzeichnung:** aus Code gelesen; Zahlen gemessen
- **Beschreibung:** Die README sagt: `cd backend && npm install && npm start` plus „eine
  `.env` mit `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET` und
  `ACTIVITY_PHOTO_ENCRYPTION_KEY`". Drei Dinge stimmen nicht:
  1. **Keine `.env`-Verarbeitung.** `grep -rn dotenv backend --exclude-dir=node_modules`
     liefert 0 Treffer; `npm start` ist `node server.js`. Eine `.env`-Datei wird nicht
     gelesen, die Variablen müssen in der Umgebung stehen (oder per Compose).
  2. **Kein Schema.** `database.js` führt beim Start nur die Migrationen aus
     `backend/migrations/` aus, und die Kette beginnt bei `064`. Das Grundschema kommt
     ausschließlich über `init-scripts/01-create-schema.sql` (Docker-Entrypoint) — die
     README erwähnt `init-scripts/` mit keinem Wort. Gegen eine leere PostgreSQL läuft
     die erste Migration ins Leere.
  3. **Testzahlen.** README: „1625 Tests" (Frontend), „2470 Tests" (Backend). Gezählt:
     Backend 3333 `it(`/`test(`-Aufrufe in 144 Testdateien; Frontend 2622 `it(`-Zeilen in
     264 Dateien (die Koordination hat 3788 ausgeführte Tests gemessen — `it.each`
     entfaltet mehr, als `grep` zählt). Beide README-Zahlen sind um 35–60 % zu niedrig.
  Dazu die Aussage „**Handbuch in der App**": In `frontend/src` gibt es keinen Link auf
  `/docs` (grep über alle `.tsx`/`.ts` ohne Tests: 0 Treffer außer Kommentaren). Das
  Handbuch ist nur über die Website (`landing.html`, vier Links) erreichbar.
- **Auswirkung aus Nutzersicht:** Wer die App für eine eigene Gemeinde ausprobieren
  will (Lizenz erlaubt „zu Lern- und Prüfzwecken ausführen"), scheitert nach der
  README am ersten Start. Die falschen Testzahlen untergraben genau das Vertrauen, das
  der Lizenztext beansprucht („nachprüfbar").
- **Beleg:**
  ```
  $ grep -rn dotenv backend --include='*.js' --include='*.json' --exclude-dir=node_modules
  (leer)
  $ ls backend/migrations | head -1
  064_add_missing_fks.sql
  $ grep -rE "^\s*(it|test)(\.each\([^)]*\))?\(" backend/tests --include='*.test.js' | wc -l
  3333
  ```
- **Empfehlung:** Abschnitt „Selbst betreiben" neu schreiben: Variablen exportieren
  oder Compose nutzen, `init-scripts/` als Pflichtschritt nennen, Testzahlen aus der
  Vitest-Ausgabe übernehmen oder streichen; „Handbuch in der App" in „Handbuch auf der
  Website" ändern oder einen Link in der App ergänzen.

### BF-02: Handbuch verspricht eine Bestätigungs-Mail beim Ändern der E-Mail-Adresse — der Code schreibt sofort
- **Schwere:** MITTEL
- **Fundstelle:** `docs/handbuch/35-passwoerter.md:373-378`; `backend/routes/auth.js:455-480`;
  `docs/api/verwaltung-auth.yaml:288-291` (N8)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Das Handbuch: „Zur Bestätigung geht eine Mail an die **neue**
  Adresse — erst nach dem Klick darin gilt sie. Solange das nicht bestätigt ist,
  funktioniert ‚Passwort vergessen' noch mit der alten." Die Route
  `POST /api/auth/update-email` prüft nur das Format und führt sofort
  `UPDATE users SET email = $1 WHERE id = $2` aus. Es gibt keinen Token, keine Mail,
  keinen Zwischenzustand. Die API-Doku sagt das an derselben Stelle richtig („keine
  Besitz-Verifikation der E-Mail", N8, „bewusst so belassen").
- **Auswirkung aus Nutzersicht:** Eine Konfi, die sich vertippt, glaubt laut Handbuch,
  die alte Adresse gelte weiter — tatsächlich ist „Passwort vergessen" ab sofort tot.
  Wer ein fremdes Konto in der Hand hat, kann die Adresse ohne Hürde umhängen; das
  Handbuch behauptet eine Schutzstufe, die nicht existiert.
- **Beleg:** `auth.js:469`: `await db.query(\`UPDATE users SET email = $1 WHERE id = $2\`, [trimmedEmail, userId]);` — keine weitere Zeile zwischen Validierung und UPDATE.
- **Empfehlung:** Entweder das Handbuch auf das tatsächliche Verhalten setzen (mit dem
  Hinweis, dass die alte Adresse sofort ungültig ist), oder die Bestätigung bauen und
  N8 in der API-Doku schließen. Nicht beides offen lassen.

### BF-03: Jahrgangs-Zuweisung nach Beförderung — Handbuch widerspricht sich selbst, Kapitel 45 widerspricht dem Code
- **Schwere:** MITTEL
- **Fundstelle:** `docs/handbuch/45-jahrgaenge.md:221-222` („übernimmt das System
  seinen Jahrgang automatisch als Zuweisung, mit Lese- und Bearbeitungsrecht");
  `docs/handbuch/05-rollen.md:261-266` und `docs/handbuch/30-leitung.md:66-67`
  („bewusst **nicht** automatisch"); `backend/routes/konfi-management.js:1603-1618`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der Code hat die automatische Zuweisung am 01.09.2026 entfernt
  („6. KEINE automatische Jahrgangs-Zuweisung mehr … entfällt ersatzlos"). Kapitel 05
  und 30 beschreiben das richtig, Kapitel 45 beschreibt den alten Stand. Zwei Kapitel
  desselben Handbuchs sagen das Gegenteil voneinander.
- **Auswirkung aus Nutzersicht:** Die Leitung befördert eine Konfi, liest in Kapitel
  45, dass sie den Jahrgang automatisch hat — und wundert sich, warum die neue
  Teamer:in keine Konfis sieht und aus dem Jahrgangs-Chat fällt (genau die Folge, die
  der Code-Kommentar beschreibt).
- **Beleg:** `konfi-management.js:1603`: `// 6. KEINE automatische Jahrgangs-Zuweisung mehr (01.09.2026).`
- **Empfehlung:** Den Satz in 45-jahrgaenge.md streichen und auf
  `05-rollen.md#eine-rolle-aendern` verlinken.

### BF-04: Rechte-Tabelle und Teamer-Kapitel widersprechen sich und dem Code bei Challenges
- **Schwere:** MITTEL
- **Fundstelle:** `docs/handbuch/05-rollen.md:117` („Challenges anlegen und begleiten
  | — | — | ja | ja" — Teamer:in: nein); `docs/handbuch/20-teamer.md:52-56`
  („anlegen und bearbeiten, löschen, Beiträge freigeben …");
  `backend/routes/challenges.js:1325,1439` (`requireTeamer`), `:1603-1613`
  (`DELETE /admin/:id` → `requireAdmin`), `:1931` (`DELETE /admin/submissions/:id` →
  `requireAdmin`); `frontend/src/components/admin/views/ChallengesManageView.tsx:212`
  (`const darfLoeschen = user?.type === 'admin'`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Code und Oberfläche: Teamer:innen dürfen Challenges **anlegen,
  bearbeiten, freigeben, ausblenden, anonymisieren**, aber **nicht löschen**
  (Nutzerentscheid 28.08.2026, durch Tests abgesichert:
  `backend/tests/routes/challenges.test.js:3000-3010`). Kapitel 05 verneint das Anlegen
  für Teamer:innen komplett; Kapitel 20 verspricht das Löschen. Beides ist falsch,
  und zwar in entgegengesetzte Richtungen. Kapitel 80 (`80-challenges.md:225`) hat es
  richtig („Das dürfen nur Admins und Org-Admins, nicht Teamer:innen").
- **Auswirkung aus Nutzersicht:** Eine Teamer:in liest in Kapitel 20, sie könne
  löschen, findet den Wisch nicht und hält die App für kaputt. Eine Leitung liest in
  Kapitel 05, Teamer:innen könnten keine Challenges anlegen, und plant die Arbeit
  falsch.
- **Beleg:** `ChallengesManageView.tsx:212`: `const darfLoeschen = user?.type === 'admin';` — für `teamer` wird die Lösch-Option nicht gerendert; `challenges.js:1605`: `requireAdmin`.
- **Empfehlung:** Zeile 117 in 05-rollen.md auf „ja (eigene Jahrgänge), ohne Löschen"
  setzen; in 20-teamer.md „löschen" streichen. Der Satz aus 80-challenges.md ist die
  Vorlage.

### BF-05: Store-Texte für 2.3.0 fehlen, `release-notes-de.txt` ist schon umgestellt
- **Schwere:** MITTEL
- **Fundstelle:** `docs/store-texte-2.2.0.md` (letzte Fassung), `frontend/release-notes-de.txt`
  (489 Zeichen, Inhalt 2.3.0), `.github/workflows/android-release.yml:120`,
  `.github/workflows/ios-release.yml:48-61`
- **Kennzeichnung:** reproduziert (`ls docs/store-texte-2.3.0.md` → nicht vorhanden;
  `wc -c frontend/release-notes-de.txt` → 489)
- **Beschreibung:** Der in `store-texte-*.md` dokumentierte Prozess lautet „Wer den
  Text hier ändert, ändert die Datei mit" — die Doku ist die Quelle, die Datei das
  Abbild. Für 2.3.0 ist es umgekehrt: Die Play-Datei trägt den 2.3.0-Text, eine
  `store-texte-2.3.0.md` mit iOS- und Android-Fassung gibt es nicht. Damit fehlt der
  iOS-Text vollständig im Repo, und die Plattform-Wort-Prüfung des iOS-Workflows
  (liest `docs/store-texte-*.md`) prüft für 2.3.0 nichts. Der Android-Text nennt
  außerdem „Dunkelmodus" — den es laut CHANGELOG erst in dieser Version gibt — als
  Verbesserung („setzen sich deutlicher ab"), als wäre er schon da.
- **Auswirkung aus Nutzersicht:** Nutzer:innen im App Store lesen entweder den alten
  2.2.0-Text oder einen Text, der nie gegen den CHANGELOG gelesen wurde. Die
  Ablehnung vom 29.08.2026 (Guideline 2.3.10) entstand genau so.
- **Beleg:** siehe Kennzeichnung; `android-release.yml:8`: „frontend/release-notes-de.txt aktualisieren, committen."
- **Empfehlung:** `docs/store-texte-2.3.0.md` nach dem Muster von 2.2.0 anlegen
  (iOS-Text ohne Plattform-Wörter, Android ≤ 500 Zeichen), Prüfschritte durchgehen,
  dann erst einreichen.

### BF-06: `ABRISS.md` führt Routen als aufruferlos, die 2.3.0 ruft — und verweist auf verschobene Zeilen
- **Schwere:** MITTEL
- **Fundstelle:** `docs/api/ABRISS.md:161-162` (`GET`/`PUT /api/notifications/preferences`),
  `:191` (`createApp.js:480` und `:483`), `:157` („115 Zeilen"), `:184`
  (`services/api.ts:89`), `:186` (`backgroundService.js:761`, `wrapped.test.js:181-218`);
  `frontend/src/components/shared/PushAuswahl.tsx:77,136`
- **Kennzeichnung:** reproduziert (`grep -rn "notifications/preferences" frontend/src --include='*.ts' --include='*.tsx' | grep -v __tests__` → 3 Treffer, davon 2 API-Aufrufe)
- **Beschreibung:** Tabelle B („Ohne Aufrufer in der Oberfläche", Stand 01.09.2026)
  nennt beide `preferences`-Routen mit Ersatz `/api/settings`. Seit der Push-Auswahl
  in der App (Commit `f250af8c`) ruft `PushAuswahl.tsx` genau diese Routen (`api.get`
  Zeile 77, `api.put` Zeile 136). Die Liste ist eine Abrissmerkliste; wer ihr folgt
  und die Zugriffszählung nur über den alten Zeitraum liest, reißt die Push-Auswahl
  der ausgelieferten 2.3.0 ab. Daneben sind mehrere Zeilenverweise veraltet: Die
  Mounts stehen in `createApp.js:576/579` (nicht 480/483), der Refresh-Aufruf in
  `api.ts:107` (nicht 89), `GET /api/konfi/events/:id/status` hat 95 Zeilen (nicht
  115), die Wrapped-Tests stehen in `wrapped.test.js:136-192`, und in
  `backgroundService.js` gibt es keine Zeile 761 mit `generate-teamer`-Bezug mehr
  (der Cron ruft `checkWrappedTriggers`, Zeile 969).
- **Auswirkung aus Nutzersicht:** Beim nächsten Abriss verschwindet die Auswahl
  „welche Mitteilungen aufs Handy kommen" für alle Nutzer:innen der 2.3.0.
- **Beleg:** `PushAuswahl.tsx:77`: `const res = await api.get('/notifications/preferences');`
- **Empfehlung:** Beide Zeilen aus Tabelle B in Tabelle C („bleiben dauerhaft")
  verschieben; Zeilenverweise auf Funktionsnamen statt Zeilennummern umstellen.

### BF-07: API-Referenz zeigt für fünf Routen Rollen, die nicht (mehr) gelten; drei Kopfaussagen sind veraltet
- **Schwere:** MITTEL
- **Fundstelle:**
  - `docs/api/verwaltung-auth.yaml:881-895` (`GET /api/organizations/{id}`) und
    `:1089-1102` (`…/{id}/stats`): `rollen: [super_admin, "jede Rolle der eigenen Org"]`
    — Code `organizations.js:203,1288`: `requireOrgVerwaltung` (= `requireTeamer` oder
    Super-Admin). Der Hinweis darunter sagt „BEHOBEN 22.08.2026 … Konfis erhalten 403",
    die `rollen`-Zeile wurde nicht nachgezogen. Die erzeugte Referenz
    (`frontend/public/docs/api/index.html`) zeigt „jede Rolle der eigenen Org" 2×.
  - `verwaltung-auth.yaml:878` (`GET /api/organizations/current`): `hinweis: "Auch
    Konfis/Teamer sehen den vollen Org-Datensatz … — siehe N5"` — Code `:151`:
    `requireOrgVerwaltung`. Der Hinweis beschreibt ein geschlossenes Problem als offen.
  - `docs/api/chat-challenges.yaml` (`DELETE /api/challenges/admin/{id}` und
    `DELETE /api/challenges/admin/submissions/{id}`): `rollen: [org_admin, admin, teamer]`,
    `middleware: [rbacVerifier, requireTeamer]` — Code seit 28.08.2026 `requireAdmin`
    (`challenges.js:1605,1933`).
  - `docs/api/teamer-material.yaml` (`DELETE /api/wrapped/ausgabe/{id}`,
    `GET /api/wrapped/ausgaben`): `rollen: [admin, org_admin, super_admin]` — Code
    `requireAdmin` (`wrapped.js:2720,2894`) lässt `super_admin` nicht durch (403), wie
    der yaml-Kopf selbst festhält („Fachrouten … super_admin fällt dort durch").
  - Kopfzeilen: `verwaltung-auth.yaml:4` „112 Routen" (gezählt 66); `:13-14`
    „User-Verwaltung … komplett requireOrgAdmin" (Code `users.js:85-878`:
    `requireAdmin`, die eigene `x-berechtigung` sagt korrekt `[org_admin, admin]`);
    `:31-32` „Multi-Org-Mitgliedschaften vergibt NUR der super_admin" (seit `f770270f`
    lädt der Org-Admin über `/api/einladungen` ein — dieselbe Datei dokumentiert es
    weiter unten). Auch die Routenzahlen je Datei sind veraltet: chat 24/13/9 → 24/15/10,
    konfis-events 24/21/16/10 → 25/23/17/11, teamer-material 22/13/6 → 26/9/9,
    stammdaten 27 → 28.
- **Kennzeichnung:** reproduziert (`node scratchpad/…/routen-vergleich.mjs`, Abschnitt
  `rollenAbw`; jede Zeile am Code nachgesehen)
- **Beschreibung:** Die Referenz ist als Rechte-Nachschlagewerk gebaut („mit den
  Rollen, die sie aufrufen dürfen"). An fünf Routen steht eine falsche Rolle, an einer
  ein Hinweis auf ein längst geschlossenes Datenleck.
- **Auswirkung aus Nutzersicht:** Wer die Referenz für ein Sicherheitsreview der
  EKD liest, findet ein Datenleck (N5), das es nicht mehr gibt, und Löschrechte für
  Teamer:innen, die es nicht gibt — beides kostet Vertrauen oder Nacharbeit.
- **Beleg:** `challenges.js:1603-1605`:
  ```js
  router.delete('/admin/:id',
    rbacVerifier,
    requireAdmin,
  ```
  gegen `chat-challenges.yaml` (delete-Block): `middleware: [rbacVerifier, requireTeamer]`.
- **Empfehlung:** Die fünf `rollen`/`middleware`-Zeilen korrigieren, Hinweis an
  `/current` als behoben markieren, Kopfzeilen entweder pflegen oder die Zahlen
  streichen (die Generatoren zählen ohnehin).

### BF-08: Datenschutz-Dokumentation nicht auf dem Stand von 2.3.0; Rechenschaftsunterlagen fehlen
- **Schwere:** MITTEL
- **Fundstelle:** `frontend/public/datenschutz.html:337` („Stand: Juni 2026"),
  Abschnitte 9a (Umami, ergänzt Commit `0ad9ded3` vom 10.08.2026) und 9b (Crashlytics,
  ergänzt `a67b6a01` vom 24.09.2026); `backend/routes/einladungen.js`,
  `backend/middleware/rbac.js:146-160` (aktive Organisation); Repo-weite Suche nach
  „Verarbeitungsverzeichnis", „Auftragsverarbeitung", „technische und organisatorische"
- **Kennzeichnung:** reproduziert (`git log -S"Crashlytics" -- frontend/public/datenschutz.html` → `a67b6a01 2026-09-24`; `grep -c "mehrere Gemeinden\|zweite Gemeinde\|Mitgliedschaft" frontend/public/datenschutz.html` → 0)
- **Beschreibung:** Drei Lücken:
  1. Die Erklärung trägt „Stand: Juni 2026", obwohl zwei Verarbeitungen (anonyme
     Nutzungsmessung in der App, Absturzberichte an Google) danach aufgenommen wurden.
  2. 2.3.0 führt eine neue Verarbeitung ein: Die Leitung einer Gemeinde lädt eine
     Person mit bestehendem Konto ein; nach Zusage sind Name, Benutzername,
     Rolle und Jahrgangs-Zuweisungen dieser Person in einer **zweiten** Gemeinde
     sichtbar und verwaltbar (Handbuch 05, „Mitarbeitende der eigenen Gemeinde
     verwalten"). Die Datenschutzerklärung kennt nur „die Gemeinde".
  3. Im Repo liegt weder ein Verzeichnis der Verarbeitungstätigkeiten (§ 31 DSG-EKD)
     noch eine Beschreibung der technisch-organisatorischen Maßnahmen noch ein
     Verweis, wo diese Unterlagen geführt werden. Die Erklärung behauptet „Mit den
     Anbietern haben wir jeweils einen Vertrag über Auftragsverarbeitung (AVV)
     geschlossen" — belegt ist das im Repo nicht. Für eine Ausrollung an die EKD mit
     10.000–25.000 überwiegend minderjährigen Nutzer:innen ist das die erste Frage,
     die eine kirchliche Datenschutzaufsicht stellt. (Ob diese Unterlagen in ein
     **öffentliches** Repo gehören, ist zu Recht fraglich — dann gehört zumindest ein
     Verweis hierher, wo sie liegen.)
  Positiv: Firebase Cloud Messaging, Crashlytics, Umami, Hosting, Minderjährigen-
  schutz und die DSG-EKD-Betroffenenrechte sind beschrieben; der Losungs-Dienst
  (`ketiv.de`, serverseitig, ohne Personenbezug) muss nicht genannt werden.
- **Auswirkung aus Nutzersicht:** Eltern und Konfis lesen eine Erklärung, die nicht
  sagt, dass die Daten eines Teamers in einer zweiten Gemeinde sichtbar werden
  können. Für die Leitung: Beim EKD-Rollout fehlen die Unterlagen, die sie vorlegen
  muss.
- **Beleg:** `datenschutz.html:337`: `Stand: Juni 2026`; `git log --format='%h %cs' -1 -- frontend/public/datenschutz.html` → `a67b6a01 2026-09-24`.
- **Empfehlung:** Stand aktualisieren, Abschnitt zur Mitarbeit in mehreren
  Gemeinden ergänzen (was wer sieht, wer zustimmt), und ein kurzes
  `docs/datenschutz.md` anlegen, das sagt, wo Verarbeitungsverzeichnis, TOM und AVVs
  liegen — nicht deren Inhalt.

### BF-09: Zwei Routen ohne API-Dokumentation — eine davon aus dem heutigen Feature-Commit
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/einladungen.js:199` (`DELETE /api/einladungen/:id`,
  Commit `f770270f`, 26.09.2026); `backend/routes/wrapped.js:2824`
  (`GET /api/wrapped/team-jahre`, Commit `d5bd1b39`, 08.09.2026)
- **Kennzeichnung:** reproduziert (`node scratchpad/…/routen-vergleich.mjs` → `ohneDoku: 2`)
- **Beschreibung:** Von 265 eindeutigen Routen fehlen zwei in `docs/api/*.yaml`. Der
  Commit `f770270f` hat die yaml um 106 Zeilen erweitert (fünf `einladungen`-Routen),
  aber das Zurückziehen (`DELETE`) vergessen — obwohl CHANGELOG und Handbuch die
  Funktion nennen („lässt sich zurückziehen"). CLAUDE.md verlangt die API-Doku im
  selben Commit. Umgekehrt gibt es **keine** dokumentierte Route ohne Code und **keine**
  Methodenabweichung.
- **Auswirkung aus Nutzersicht:** keine direkte; die Referenz ist zu 99,2 % vollständig.
- **Beleg:** Skriptausgabe: `Routen: 280 (eindeutig 265) | Doku: 263 | ohne Doku: 2 | ohne Route: 0 | Methode abweichend: 0`.
- **Empfehlung:** Beide Routen nachtragen, Generatoren laufen lassen.

### BF-10: CHANGELOG `[Unreleased]` verletzt das eigene Format an mehreren Stellen
- **Schwere:** NIEDRIG
- **Fundstelle:** `CHANGELOG.md:12,123,181,187,206,215,221,410` (Abschnittsüberschriften),
  `:19-27` (Widerspruch), `:182` vs `:325`, `:207`, `:406`, `:3-8` (Kopf);
  `package.json:3` (`2.9.0`), `backend/package.json:3` (`1.0.1`),
  `frontend/package.json:4` (`0.0.1`), `backend/createApp.js:405`
- **Kennzeichnung:** reproduziert (`grep -n "^### " <Unreleased-Auszug>`)
- **Beschreibung:**
  1. **Doppelte Abschnitte:** „Hinzugefügt" 2×, „Geändert" 2×, „Sonstiges" 2× im
     selben Versionsblock — Keep a Changelog kennt jede Kategorie einmal je Version.
  2. **Widerspruch im Text:** Eintrag 1 sagt, die Gemeindeleitung lade selbst ein;
     Eintrag 2 (Zeile 26-27) sagt „Eine zweite Mitgliedschaft wird beim Betrieb von
     Konfi Quest beantragt". Der Code kennt heute beide Wege (Einladung durch
     `org_admin`, Mitglieder-Pflege durch `super_admin`), der Text liest sich aber
     als Entweder-oder.
  3. **Hinzugefügt und im selben Block wieder entfernt:** „Mitteilungen prüfen"
     (Zeile 182 hinzugefügt, Zeile 325 entfernt), „Absturzmeldung prüfen" (Zeile 207
     unter „Entfernt", nie in einem Release enthalten). Unreleased beschreibt die
     Netto-Änderung gegenüber 2.2.0; beides ist netto null.
  4. **Framework-Name:** Zeile 406 „Ionic-Bedienelemente" — CLAUDE.md verbietet
     Framework-Namen. In den Release-Blöcken 2.2.0 und 2.1.1 gibt es dagegen keinen
     Verstoß in den Einträgen (nur die Build-Zeile unter der Überschrift).
  5. **CLAUDE.md gegen CHANGELOG-Kopf:** CLAUDE.md „Niemals Build-Nummern", der Kopf
     „Store-Builds stehen jeweils unter der Versionsüberschrift" — 10 Versionen tun das.
     Eine der beiden Regeln muss die Ausnahme benennen.
  6. **Versionsnummern:** CHANGELOG 2.3.0, iOS `MARKETING_VERSION = 2.3.0`,
     Root-`package.json` 2.9.0, `backend/package.json` 1.0.1, `frontend/package.json`
     0.0.1. `GET /api/status` liefert `version` aus `backend/package.json` → „1.0.1".
- **Auswirkung aus Nutzersicht:** Wer im Betrieb `/api/status` liest, sieht Version
  1.0.1 auf einem 2.3.0-System. Leser:innen des CHANGELOG finden Funktionen, die es
  in keiner ausgelieferten Version gab.
- **Beleg:** `sed -n '10,417p' CHANGELOG.md | grep -n "^### "` → 8 Überschriften, 3 Kategorien doppelt.
- **Empfehlung:** Abschnitte zusammenführen, die beiden Netto-null-Paare streichen,
  Satz zur Mitgliedschaft präzisieren, „Ionic" ersetzen, Versionsnummern
  vereinheitlichen (oder `/api/status` aus `frontend/version.json` speisen).

### BF-11: Veraltete Verhaltensaussagen im Handbuch (vier Stellen)
- **Schwere:** NIEDRIG
- **Fundstelle:**
  - `03-bedienung.md:271-274` („Im Profil steht unter „Mitteilungen prüfen" …") —
    `grep -rn "Mitteilungen prüfen" frontend/src --include='*.tsx' | grep -v __tests__`
    → 0 Treffer; CHANGELOG Zeile 325 dokumentiert die Entfernung (Commit `ef47d36b`).
  - `70-termine.md:91` („Max. Teilnehmer:innen 5 (einstellbar 1 bis 50)") —
    `EventFormSections.tsx:302`: `max={Math.max(30, formData.max_participants)}`;
    CHANGELOG nennt die Absenkung („alltagstaugliches Maß").
  - `45-jahrgaenge.md:160-165` („Die Übersetzungstexte sind aus Lizenzgründen leer …
    der Freitext-Weg ist dann der einzige") — Migration
    `134_konfspruch_texte.sql` (28.08.2026) füllt Luther 2017 und Gute Nachricht für
    alle 32 Sprüche; nur BigS und Elberfelder bleiben leer. Der Store-Text 2.1.0 sagt
    es richtig („Wortlaut in Luther 2017 und Gute Nachricht").
  - `20-teamer.md:52-56` — siehe BF-04 (löschen).
- **Kennzeichnung:** aus Code gelesen; „Mitteilungen prüfen" reproduziert per grep
- **Beschreibung:** Vier Aussagen beschreiben einen früheren Stand.
- **Auswirkung aus Nutzersicht:** Wer nach „Mitteilungen prüfen" sucht, findet es
  nicht; wer 50 Plätze eintragen will, findet den Regler bei 30 gedeckelt (Handbuch
  verspricht mehr); Leitung glaubt, die Spruchliste zeige keine Texte.
- **Empfehlung:** Stellen korrigieren; für 45 den Hinweis auf zwei gefüllte und zwei
  leere Übersetzungen umformulieren.

### BF-12: `docs/offene-befunde.md` führt #12 und #13 als offen, beide sind seit dem 16.09.2026 erledigt
- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/offene-befunde.md:429-438` (#12 „IN ARBEIT"), `:440-449`
  (#13 „Der Umbau läuft"); `init-scripts/README.md`, Commit `a5230d86` (16.09.2026),
  `backend/tests/schema/neuinstallation.test.js`; `backend/routes/events/index.js:3-14`,
  `routes/events/verwaltung.js:72,339,784,1033,1101,1288,1484` (alle `requireAdmin`),
  CHANGELOG 2.2.0 „Termine anlegen, ändern und absagen ist Sache der Leitung"
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** #12: `init-scripts/01-create-schema.sql` ist seit `a5230d86` der
  Produktions-Dump, `02-migrationsstand.sql` und der Wächter
  `neuinstallation.test.js` existieren — genau das, was der Eintrag als „läuft"
  ankündigt. #13: Alle Schreibrouten der Termine verlangen `requireAdmin`, die
  Teamer-Oberfläche bindet `TerminAbsagenModal` nicht mehr ein
  (`TeamerEventsPage.tsx:74`), CHANGELOG 2.2.0 beschreibt es als ausgeliefert. Für das
  Release ist hier nichts mehr zu entscheiden; die Einträge lesen sich aber so.
- **Empfehlung:** Beide Titel auf „BEHOBEN 16.09.2026" setzen und die Fundstellen
  nennen — wie die Datei es selbst verlangt („Behobene … bleiben stehen und werden im
  Titel als solche markiert").

### BF-13: Sitemap-Erzeugung nicht reproduzierbar, von der CI nicht geprüft
- **Schwere:** NIEDRIG
- **Fundstelle:** `scripts/build-handbuch.mjs:699-707` (`statSync(...).mtime`),
  `:744` (`heute()` für `/docs/`), `.github/workflows/ci.yml:210-219`
- **Kennzeichnung:** reproduziert (`node scripts/build-handbuch.mjs && git diff --stat frontend/public/sitemap.xml` → `1 file changed, 10 insertions(+), 10 deletions(-)`; danach `git restore frontend/public/sitemap.xml`)
- **Beschreibung:** Der Kommentar verspricht „Änderungsdatum der Quelldatei — nicht
  heute". Genommen wird aber die Datei-`mtime`, und die ist in jedem frischen Checkout
  (CI, andere Maschine) der Zeitpunkt des Auscheckens. Zehn `lastmod`-Werte änderten
  sich beim Lauf, obwohl sich an den Quellen nichts geändert hat; `/docs/` bekommt
  immer das Tagesdatum. Die CI vergleicht nur `frontend/public/docs/`, die Sitemap
  liegt daneben (`frontend/public/sitemap.xml`) und wird nie verglichen — Drift fällt
  nicht auf. Die drei Erzeugnisse unter `frontend/public/docs/` waren dagegen exakt auf
  Stand (0 Zeilen Diff).
- **Auswirkung aus Nutzersicht:** keine; Suchmaschinen bekommen falsche
  Änderungsdaten.
- **Empfehlung:** `git log -1 --format=%cs -- <datei>` statt `mtime` (mit
  `mtime`-Rückfall), und die Sitemap in den CI-Vergleich aufnehmen.

### BF-14: Wissensdateien beschreiben einen Stand vom 24.08.2026, der in drei Punkten nicht mehr gilt
- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/wissen/abzeichen.md:5,53-56`; `docs/wissen/zaehler.md:10-11,16,25`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** `abzeichen.md` verweist auf `events.js:2915/2883/2779/474` — die
  Datei existiert seit dem 28.08.2026 nicht mehr (aufgeteilt in `routes/events/*`);
  sie behauptet einen „Hintergrundjob alle 5 Minuten für alle Nicht-Admins **MIT
  Push-Token**" — heute läuft die Abzeichen-Prüfung **stündlich**
  (`backgroundService.js:103-109`, `EINE_STUNDE`) und für **alle** aktiven Personen
  (`:137-139`: „NICHT nur die mit Push-Token"). Das Handbuch (60-badges.md, „stündlich")
  hat es richtig. `zaehler.md` nennt `GET /api/notifications/counts` — die Route heißt
  `/badge-counts` (`notifications.js:42`) — und `BadgeContext.tsx:144-147` für
  `Badge.set/clear` (heute Zeile 470-471). Beide Dateien nennen ihren Stand ehrlich
  („Stand: 24.08.2026", „Zeilennummern … Commit 197f5e66"); sie werden aber weder
  gepflegt noch als historisch markiert.
- **Empfehlung:** Entweder pflegen oder einen Kopfvermerk „historisch, nicht gepflegt"
  setzen; die Takt- und Filteraussage in `abzeichen.md` korrigieren.

### BF-15: Code-Kommentare mit veralteten Zahlen und toten Dateiverweisen
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/middleware/rbac.js:297` („345-mal … nur einmal aus der
  Anfrage"); `scripts/build-api-docs.mjs:191-195`; `scripts/build-handbuch.mjs:29,373,584-586`;
  Dateiverweise auf `routes/events.js`, `events.js`, `BAUSTELLEN.md`, `openapi.js`
- **Kennzeichnung:** reproduziert (`grep -rn "req\.user\.organization_id" backend/routes backend/createApp.js backend/utils backend/services --include='*.js' | wc -l` → 474; Verweis-Skript über 177 Ziele → 4 nicht auffindbar)
- **Beschreibung:** Von 15 nachgerechneten Behauptungen stimmen 9 (siehe „Geprüft und
  in Ordnung"), 6 sind veraltet:
  1. `rbac.js:297`: 345 → heute 474 Stellen (die zweite Hälfte der Aussage, „nur
     einmal aus der Anfrage", stimmt weiter: genau `auth.js:624`).
  2. `build-api-docs.mjs:191-195`: beschreibt eine Datumsquelle aus `git`, die es im
     Skript nicht gibt — es wird gar kein Datum geschrieben.
  3. `build-handbuch.mjs:29,373`: „Zwölf Kapitel", `:584` „dreizehn Kapitel" — es sind 14.
  4. `build-handbuch.mjs:586`: „das Wrapped-Kapitel hat 28 Abschnitte" — 27 (10 h2 + 17 h3).
  5. Vier Dateiverweise in Kommentaren zeigen ins Leere: `routes/events.js`/`events.js`
     (aufgeteilt), `BAUSTELLEN.md`, `openapi.js` (heißt `build-openapi.mjs`).
  6. `docs/api/ABRISS.md` Zeilenverweise — siehe BF-06.
- **Empfehlung:** Zahlen in Kommentaren nur mit Datum („gezählt am …") oder gar nicht;
  tote Verweise ersetzen.

### BF-16: Handbuch dokumentiert die Super-Admin-Rolle und drei ihrer Funktionen nicht
- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/handbuch/05-rollen.md:7-8` („Jede Person … hat genau eine
  Rolle: Konfi, Teamer:in, Admin oder Org-Admin"), `00-start.md:15` („Es gibt vier
  Rollen"); `backend/middleware/rbac.js:55-60` (fünf Rollen);
  `frontend/src/navigation/rollenBaeume.ts:301` (`super_admin`-Baum),
  `AdminOrganizationsPage.tsx`, `AdminMetricsPage.tsx`, `organizations.js:310-320`
  (30-Tage-Testphase)
- **Kennzeichnung:** reproduziert (`grep -il "Super-Admin\|Auslastung\|Metrik\|Testphase\|Organisation anlegen" docs/handbuch/*.md` → 0 Kapitel)
- **Beschreibung:** Undokumentiert sind (gezählt): (1) die Rolle `super_admin` und
  das Anlegen/Sperren von Gemeinden samt Tarif/Konfi-Limit, (2) der Betriebs-Überblick
  (Auslastung, Routen, Fehler — sieben CHANGELOG-Einträge in 2.3.0), (3) die
  30-Tage-Testphase mit Hinweis und Sperre. Alle sieben im Auftrag genannten
  2.3.0-Funktionen (Postfach/Glocke, Push-Auswahl, Gemeinde-Umschalter, Einladung
  bestehender Personen, Dunkelmodus, Änderungsanzeige, Team-Rückblick je Gemeinde)
  **sind** dagegen dokumentiert (03, 05, 95). „Betrieb" und „Organisationen" werden in
  05/30 nur als Seitennamen erwähnt.
- **Auswirkung aus Nutzersicht:** Für Gemeinden keine — die Funktionen gehören dem
  Betreiber. Für den EKD-Rollout fehlt die Beschreibung, wie eine neue Gemeinde
  entsteht und was die Testphase bedeutet.
- **Empfehlung:** Kurzes Kapitel „Für den Betrieb" oder ein Absatz in 05 mit der
  fünften Rolle.

### BF-17: Handbuch-Stil: 45 von 268 Überschriften sind Substantive, eine Stelle blickt zurück
- **Schwere:** NIEDRIG
- **Fundstelle:** z. B. `05-rollen.md:18,28,35,46` („### Konfi", „### Teamer:in",
  „### Admin", „### Org-Admin"), `10-konfis.md:78`/`20-teamer.md:71`/`30-leitung.md:100`
  („### Events"), `30-leitung.md:173,180,188` („### Konto", „### Verwaltung (nur
  Org-Admin)", „### Inhalt"), `60-badges.md:119-302` (14 Bedingungsnamen als h4);
  `70-termine.md:853` („Bei Terminen, die vor der Einführung des Grundes abgesagt wurden")
- **Kennzeichnung:** reproduziert (Heuristik: Überschrift endet nicht auf Verb und
  beginnt nicht mit „Wissen,/Nachvollziehen,/Verstehen,/…"; Liste von Hand gesichtet)
- **Beschreibung:** CLAUDE.md: „Überschriften benennen Tätigkeiten … Kein Blick
  zurück". 36 Überschriften folgen dem Muster „Wissen, …"/„Nachvollziehen, …", 187
  weitere enden auf ein Verb; 45 sind Substantive oder Fragen. Viele davon sind als
  Untergliederung vertretbar (Bedingungsnamen in 60, Rollennamen in 05), aber „###
  Events", „### Konto", „### Inhalt" sind es nicht. „neu ist"/„seit Version": 0
  Treffer; „bisher/vorher/früher": 20 Treffer, davon 19 sachlich („fragt vorher nach"),
  einer rückblickend (70:853).
- **Empfehlung:** Die drei Bereichsüberschriften in 30 und die „Events"-h3 umbenennen
  („Termine anlegen und verbuchen" o. ä.); 70:853 in „Bei älteren Absagen fehlt diese
  Zeile" umformulieren.

### BF-18: 27 unreferenzierte Bildschirmfotos werden mitgespiegelt und ausgeliefert
- **Schwere:** NIEDRIG
- **Fundstelle:** `scripts/build-handbuch.mjs:531-548` (kopiert alle PNGs aus
  `docs/screenshots/*/`), `frontend/public/docs/bilder/` (30 MB, 42 Dateien)
- **Kennzeichnung:** reproduziert (Verweise aus `docs/handbuch/*.md` gegen
  `docs/screenshots/` gestellt: 15 referenziert, 27 nicht; `du -sh` → 30M)
- **Beschreibung:** Das Handbuch verweist auf 15 iPhone-Bilder. Sechs iPhone-Bilder
  (5,37 MB: `konfi-challenge-detail`, `konfi-challenge-feed`, `konfi-mitmachen`,
  `leitung-abzeichen`, `leitung-jahrgaenge`, `teamer-abzeichen`) und alle 21
  Play-Bilder (13,5 MB) werden trotzdem nach `frontend/public/docs/bilder/` kopiert und
  mit dem Frontend-Container ausgeliefert. Der Generator prüft fehlende Bilder, aber
  nicht überzählige.
- **Empfehlung:** Nur referenzierte Bilder kopieren oder die Play-Bilder aus dem
  Spiegel nehmen (sie dienen dem Store, nicht dem Handbuch).

### BF-19: Zwei Netto-null-Einträge und ein Hinweis auf eine zweite Doku-Pflicht — CLAUDE.md-Verstöße in der Commit-Historie
- **Schwere:** NIEDRIG
- **Fundstelle:** Commits `d5bd1b39` (08.09., `team-jahre` ohne yaml), `f770270f`
  (26.09., `DELETE /einladungen/:id` ohne yaml), `0c8b7a11` (19.09., Android-Ausrichtung)
- **Kennzeichnung:** aus git gelesen
- **Beschreibung:** Von 101 `feat`/`fix`-Commits seit 2.2.0 haben nach Stichwort-
  Abgleich und Handdurchsicht alle nutzerrelevanten einen CHANGELOG-Eintrag; 17
  Treffer ohne Entsprechung sind Build/CI/Metrik-Interna. Einzige Ausnahme mit
  Nutzerbezug: `1546ca81` („Hochformat-Sperre entfernt") und `0c8b7a11` („Ausrichtung
  wieder fest im Manifest") — netto unverändert (`screenOrientation="portrait"` in
  2.2.0 und HEAD), daher zu Recht kein Eintrag. Umgekehrt hat jeder geprüfte
  CHANGELOG-Eintrag einen Commit (u. a. Lizenz `e1e5db9f`, Kamera-Plugin `8d1d118f`,
  Verschleierung `1546ca81`, Abstands-Tokens `a40d8dc3`, Uploads `50e7afd5`,
  Pool-Zeitgrenzen `fc340c5d`). Die zwei fehlenden API-Doku-Einträge (BF-09) sind die
  einzigen Verstöße gegen „drei Dinge im selben Commit".
- **Empfehlung:** siehe BF-09.

### BF-20: Handbuch nennt `moin@konfi-quest.de` als Absender, der Code-Standard ist `noreply@`
- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/handbuch/35-passwoerter.md:95` („Die Mails kommen von
  `moin@konfi-quest.de`"); `backend/services/emailService.js:58`
  (`SMTP_FROM || \`Konfi Quest <${SMTP_USER || 'noreply@konfi-quest.de'}>\``),
  `backend/server.js:230`
- **Kennzeichnung:** aus Code gelesen; endgültig nur auf Produktion prüfbar
  (`SMTP_FROM`/`SMTP_USER` sind Betriebsgeheimnisse)
- **Beschreibung:** Welche Adresse tatsächlich steht, entscheidet die Umgebung. Wenn
  dort `moin@` gesetzt ist, stimmt das Handbuch; der Code-Standard sagt `noreply@`.
- **Empfehlung:** siehe „Auf Produktion nachzumessen"; im Handbuch ggf. „von der
  Adresse, die auf der Website steht" schreiben.

## Unklar

- **Absenderadresse der Mails** (BF-20): hängt an `SMTP_FROM`/`SMTP_USER` in Produktion.
- **AVVs und Verarbeitungsverzeichnis** (BF-08): Die Erklärung behauptet
  abgeschlossene AVVs; ob und wo sie liegen, ist im Repo nicht ersichtlich.
- **Konfi-Kontingent-Meldung** (`35-passwoerter.md:337`): Der Text „Die Anzahl der
  Konfis ist erreicht …" konnte nur als Zeichenkette in `utils/konfiLimit.js`
  bestätigt werden, nicht sein Auslösen (braucht Datenbank).
- **`/api/status` Version 1.0.1**: Ob Produktion `npm_package_version` gesetzt hat
  (dann käme ebenfalls 1.0.1, aus `backend/package.json`), oder ob der Wert dort
  jemand liest, ist nicht prüfbar.

## Alte Befunde nachgeprüft

| Nr. | Titel | Heutiger Stand | Fundstelle |
|---|---|---|---|
| 1 | Chat: Ungelesen-Markierung | **behoben bestätigt** — Cache `chat:rooms:<userId>` wird beim Lesen verworfen | `frontend/src/contexts/BadgeContext.tsx:403-417` |
| 2 | react-router-Meldungen | **weiter offen, trifft weiter nicht** — installiert 6.30.6; `navigate(\`…\`)`/`push(\`…\`)` ohne ID-Variable: nur String-Bausteine für Rückfrage-Texte, keine Navigationsziele | `frontend/node_modules/react-router/package.json`, grep |
| 3 | Leerer DB-Dump | nicht prüfbar (Betrieb, außerhalb Repo) | — |
| 4 | Screenshots falsche Seite | **behoben bestätigt** (Skript setzt Android-Kennung, prüft Fingerabdruck) — Bilder selbst nicht neu gezogen | `scripts/screenshots.mjs:48-70` |
| 5 | CodeQL | **weiter zutreffend** — `linkifyText` erzwingt `https://` (`MessageBubble.tsx:54-55`); `mediaPreview` aus `URL.createObjectURL` (`ChallengeSubmitModal.tsx:136,153`); General-Limiter 2000/15 min (`server.js:281`) | wie genannt |
| 6 | Rückblick Kategorie-Quelle | **behoben bestätigt** — Test existiert | `backend/tests/utils/wrappedKategorien.test.js` |
| 7 | Tote Profil-Stellen | **behoben bestätigt** — `next_badge`/`recent_activities`: 0 Treffer in `frontend/src` | grep |
| 8 | Erinnerungen an Abgemeldete | **behoben laut yaml** (`konfis-events.yaml:1569`), Verhalten nicht ausgeführt (kein DB-Port) | — |
| 9 | Warteliste sechs Stellen | **behoben bestätigt** — `rueckeNach(` an 11 Aufrufstellen in 7 Dateien | `bookingUtils.js`, `konfiDeletion.js`, `events/*.js`, `konfi.js`, `konfi-management.js` |
| 10 | Abgesagte Termine unsichtbar | **behoben laut Handbuch/CHANGELOG 2.2.0**; `GET /cancelled` steht (`lesen.js:351`) | — |
| 11 | Absage lässt Verbuchte stehen | **geändert bestätigt** — Handbuch 70 („auch die du schon verbucht hattest") und yaml `:2474` decken sich | `70-termine.md:869-879` |
| 12 | init-scripts weicht ab | **behoben, Eintrag veraltet** (BF-12) | `init-scripts/README.md`, Commit `a5230d86` |
| 13 | Teamer 9 von 17 Aktionen | **aufgelöst, Eintrag veraltet** (BF-12) | `routes/events/verwaltung.js` |

Datierte Code-Kommentare (15 nachgerechnet): 9 stimmen (siehe unten), 6 veraltet (BF-15, BF-06, BF-14).

## Geprüft und in Ordnung

**API-Doku ↔ Routen (Skript, vollständig):** 265 eindeutige Routen, 263 dokumentiert,
0 dokumentierte Pfade ohne Route, 0 Methodenabweichungen, 0 doppelt dokumentierte
Operationen (`build-openapi.mjs` würde das ohnehin verhindern). Von 109 maschinell
gemeldeten Rollen-Treffern waren 103 Fehlalarme (Rollenprüfung im Handler, in der yaml
korrekt als `objekt-pruefung`/Inline-Check beschrieben — z. B. alle `/api/teamer/*`-Routen
mit `rollen: [teamer]` haben tatsächlich `if (req.user.role_name !== 'teamer') 403`,
`teamer.js:55,226,269,…`).

**14 „BEHOBEN"-Markierungen am Code bestätigt:** N5 `organizations.js:151,203,1288`
(`requireOrgVerwaltung`); N6 `organizations.js:32-39` (`passwortPolicy`); N2
`users.js:906ff.` (`token_invalidated_at = NOW()`, Refresh-Tokens revoziert); L1
`lesen.js:328,881` (`qr_token` aus Liste und Einzelansicht entfernt); Serien-Token
22.09. (`lesen.js:766ff.`); Challenge-Löschen nur Leitung `challenges.js:1605` + Test
`challenges.test.js:3000`; Absage nur Leitung `verwaltung.js:1101`; W2
`wrapped.js:3061-3095` (beide Quellen, `user_organizations`); Hierarchie
`users.js:135`, `roleHierarchy.js:93`; Teamer-Profil Gemeindename `teamer.js:60-80`
(`req.user.organization_id`); `orgMitglieder.js:64-65,74-75` (`deleted_at IS NULL`);
`/auth/me` Rolle der aktiven Gemeinde `auth.js:559-560`; Passwortregel
`passwordUtils.js` (8 Zeichen, Groß/Klein/Zahl/Sonderzeichen, keine Leerzeichen).

**Handbuch-Aussagen mit Zahl, am Code bestätigt (40):** Einladung 14 Tage
(`einladungen.js:35`); Einladungscode 8 Hex-Zeichen, 7 Tage, +7 Tage
(`auth.js:757-758,830`); Reset-Link 24 h (`auth.js:696`), 5 Anfragen/15 min
(`auth.js:20-21`); Abmelden bis 2 Tage vorher (`konfi.js:1674-1678`); Pflicht-Abmeldung
≥ 5 Zeichen (`konfi.js:1835`); Passwort-Vorschlag 14 Zeichen ohne I/O/l/0/1
(`passwortVorschlag.ts:23,31`); Einmalpasswort-Muster über 66 Bücher/1189
Kapitel/31168 Verse (`bibelVerszaehlung.js`, nachgerechnet — bestätigt auch den
Kommentar `passwordUtils.js:15`); Check-in-Fenster 5–60 min, Standard 30
(`EventFormSections.tsx:217`, `EventModal.tsx:76`; Server klemmt 5–120); Endzeit +2 h
(`EventModal.tsx:137`); Warteliste an, 3 Plätze (`EventModal.tsx:74`); Serie ≤ 26
Termine, ≤ 12 Monate, monatlich ≤ 12 (`serien.js:80-81,132-134`); Punkteziel 1–20
(`AdminJahrgaengeePage.tsx:341,373`); Bonus 1–10 (`BonusModal.tsx:193`); Level 1–40
(`LevelManagementModal.tsx:213`); Zeitbasiert 1–26 Wochen
(`BadgeManagementModal.tsx:624`); 16 Bedingungen (`badges.js:52`, gezählt); 95 Symbole
(`badgeIcons.ts`, 95 `name:`-Einträge); 27 Konfi- + 9 Teamer-Standardabzeichen
(`organizations.js:369,412`, gezählt); 6 Standard-Level (`a745a9cf`); Neu-prüfen-Sperre
60 s (`badges.js:894`); Abzeichen-Hintergrundlauf stündlich (`backgroundService.js:109`);
Mitteilungen > 365 Tage nachts gelöscht (`backgroundService.js:1064,1122`);
Team-Rückblick-Cron 6. Januar 06:00 (`backgroundService.js:966`); Chat 4000 Zeichen
(`chat.js:31`), 5 MB Server (`createApp.js:255`), App warnt bei 10 MB
(`useChatDateien.ts:82`); Material 20 MB (`createApp.js:223`); Challenge-Upload 50 MB
(`createApp.js:15`); Musikdienste Spotify/Apple Music/YouTube Music/Deezer
(`musikLinks.js:22-47`); Challenge-Vorbelegung morgen 9 Uhr / +14 Tage 20 Uhr
(`ChallengeManageModal.tsx:213-216`); Titel 200/Stempel 100/„Gestellt von" 200
(`challenges.js:376-387`); 6 Reaktionen (`chat.js:2579`); Umfrage-Ablauf 1 h/8 h/1 Tag/
7 Tage (`PollModal.tsx:315-318`); QR-Zähler alle 10 s (`QRDisplayModal.tsx:91`);
Token-Abruf mit Wiederholung bei wachsendem Abstand (`AppContext.tsx:123-126`,
`[1000, 3000]` = „noch zweimal"); Tab-Reihenfolge aller drei Rollen
(`rollenBaeume.ts:219-296` — Leitung: Konfis, Chat, Mitmachen, Challenges, Mehr);
Konfis dürfen keine Gruppen anlegen (`chat.js:538-544`); Konfi-Passwort-Reset für
Konfis **und** Teamer:innen (`konfi-management.js:632-634`); Einmalpasswort nicht für
Leitung (ebd.); Bonuspunkte durch Teamer:innen erlaubt (`konfi-management.js:1135`,
`requireTeamer`) — deckt sich mit 05 („Punkte vergeben: ja"); Benutzer:innen-Menü nur
für Org-Admin sichtbar (`AdminSettingsPage.tsx:284`); Team-Rückblick je Gemeinde
(`95-wrapped.md:182`).

**Generatoren:** Alle drei laufen fehlerfrei (Exit 0); `frontend/public/docs/**`
danach ohne Diff (0 Dateien); 176 interne Anker-Links in den erzeugten Seiten
gegengeprüft, 0 tot; alle 15 referenzierten Bilder vorhanden; `build-handbuch.mjs`
bricht bei totem Link, fehlendem Bild, fehlendem Frontmatter ab (gelesen
`:265,654-686`); `build-openapi.mjs` bricht bei Operationen ohne Tag und bei
Doppelungen ab; `build-api-docs.mjs` bricht bei unbekanntem Tag ab. Kaputtes
Markdown (unbekannte Konstrukte) landet als Absatz — ohne Fehler, aber sichtbar.

**Links:** 11 Adressen aus README/Handbuch/CHANGELOG per `curl -L` geprüft, alle 200
(konfi-quest.de, /docs/, /docs/api/, /datenschutz, /register, App Store, Google Play,
GitHub Releases/Issues, keepachangelog, semver).

**Sonstiges:** `LICENSE` und README-Lizenzabschnitt decken sich (Einsicht frei,
Betrieb mit Vereinbarung); CHANGELOG-Eintrag dazu hat den Commit (`e1e5db9f`,
21.09.); `frontend/dist/` ist ignoriert, nicht versioniert; Android
`screenOrientation="portrait"` in 2.2.0 und HEAD gleich; iOS
`MARKETING_VERSION = 2.3.0`; `init-scripts/README.md` stimmt (Kette ab 064, Dump
15.19, `refresh.sh` vorhanden); `docs/bildnachweise.md` deckt die 32 Wrapped-Bilder;
Kommentar `vitest.config.ts:26-28` (`event_date` ist `timestamp with time zone`) stimmt
mit `prod-schema.sql:976`; `ABZEICHEN_MAX_JE_LAUF = 800` (`backgroundService.js:59`)
passt zum Kommentar; Konfispruch-Übersetzungen genau vier (`konfspruch.js:32`),
Referenz 100/Text 1000 Zeichen (`093_konfspruch.sql:27`); iOS-Workflow prüft die
Store-Texte auf Plattform-Wörter (`ios-release.yml:48-61`).

## Nicht geprüft

- Antwortformen systematisch: Nur 28 von 263 Operationen tragen ein JSON-Schema (1
  mit Beispiel). Zwei Stichproben stimmten (`GET /api/app-version`: `ios`/`android`
  mit `version|null` und `url`; `GET /api/teamer/badges`: Array + Kopfzeilen
  `X-Badges-Secret-Total`/`X-Badges-Visible-Total`). Ein vollständiger Abgleich `res.json` ↔ Prosa wäre Handarbeit über
  263 Handler.
- `scripts/verwaiste-dateien.mjs`: braucht `DATABASE_URL`, kein Port zugewiesen.
- `scripts/screenshots.mjs`, `drei-ansichten.mjs`: nur gelesen, nicht gegen
  Produktion ausgeführt (kein Zugang).
- Verhalten von #8/#10 (Erinnerungen, abgesagte Termine) — Fachagenten.
- CHANGELOG-Blöcke vor 2.2.0 nur auf Formatverstöße gegrept (35 Treffer, alle
  Build-Zeilen unter Versionsüberschriften oder Alt-Einträge vor 2.0), nicht gegen
  Commits.
- Handbuch-Bilder inhaltlich (zeigen sie den heutigen Stand?) — braucht Produktion.

## Auf Produktion nachzumessen

- **Absenderadresse:** `docker exec konfi_quest-backend-1 sh -c 'echo "$SMTP_FROM / $SMTP_USER"'`
  — steht dort `moin@`, stimmt 35-passwoerter.md:95; sonst korrigieren (BF-20).
- **`/api/status` Version:** `curl -s https://konfi-quest.de/api/status | jq .version` —
  erwartet nach BF-10 „1.0.1"; wenn ja, Quelle auf `frontend/version.json` umstellen.
- **ABRISS-Zählung vor jedem Abriss** (Traefik-Log, `ABRISS.md:56-75`) — für
  `/api/notifications/preferences` **muss** sie jetzt Treffer zeigen; zeigt sie null,
  ist das Log-Fenster zu kurz, nicht die Route tot.
- **Datenschutz:** Ablage von Verarbeitungsverzeichnis, TOM und AVVs (Hosting,
  Google/Firebase) klären und im Repo verlinken (BF-08).
- **`DOCS_PASSWORD` gesetzt?** `curl -sI https://konfi-quest.de/docs/api/index.html`
  soll auf `login.html` umleiten (302), nicht 200 liefern.
