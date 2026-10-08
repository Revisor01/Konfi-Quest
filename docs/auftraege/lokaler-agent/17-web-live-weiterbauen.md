# 17. Web-Fassung live am eigenen Rechner weiterbauen

> **Übergabe 07.10.2026 abends.** Teil 1 und 3 sind erledigt und live (PR #229,
> #230). Simon will weiter an der Web-Fassung arbeiten — die nächste Sitzung
> beginnt mit „Wieder aufnehmen“ unten.

Stand 07.10.2026. Simon will an der Web-Fassung (Browser ab 992 px) auf
seinem Rechner weiterarbeiten und jede Änderung sofort im Browser sehen:
„ich möchte bitte das live auf meinem rechner machen … und dann mach ich da
weiter und sehe es immer live direkt." Der lokale Agent richtet das einmal
ein und arbeitet danach Simons Wünsche ab, während Simon zusieht. Die ersten
Wünsche stehen unter 3.

Stand des Codes: `main` mit den PRs „Web-Ansicht aller Bereiche und
Support-Vorgänge", „Rollenfarbe der Filter, Konfi-Filter, Benachrichtigungen"
und „gleicher Aufbau der Detailseiten, Liste/Kacheln", alle deployt
(Version 2.4.0, noch nicht im Store).

> **Nur gegen den lokalen Server.** Ohne `VITE_API_URL` spricht der
> Entwicklungsserver die **Produktions-API** an (`frontend/src/services/apiBasis.ts`).
> Nie ohne die Variable starten, nie mit echten Konten anmelden. Die Konten
> `review-*` und `google-test-*` nicht benutzen. Keine Adressen, Namen oder
> Passwörter ins Repo.

## 1. Einrichten

Die Werte unten sind die festen Testwerte aus `docker-compose.e2e.yml`, keine
Geheimnisse. Durchgespielt am 07.10.2026 in der Cloud-Umgebung: Datenbank aus
`init-scripts/`, Backend mit `npm run dev`, Seed, Vite-Entwicklungsserver,
Anmeldung als `admin1`, Detailseite von „Test Konfi 1" bei 1280 px.

- [x] **1. Werkzeuge.** Node nach `.nvmrc` (26), Docker. In Wurzel,
      `backend/` und `frontend/` je `npm ci`.

- [x] **2. Datenbank.** Aus der Wurzel:

          docker compose -f docker-compose.e2e.yml up -d --wait e2e-db

      Postgres 15 auf Port 5444, Schema aus `init-scripts/`. Die Daten liegen
      im Arbeitsspeicher (`tmpfs`): Nach `docker compose … down` oder einem
      Neustart von Docker ist sie leer, dann Schritt 3 und 4 wiederholen.

- [x] **3. Backend** im ersten Terminal, aus `backend/`:

          DATABASE_URL=postgresql://postgres:postgres@localhost:5444/postgres \
          JWT_SECRET='e2e-test-secret-key-min-32-chars!!' \
          QR_SECRET=e2e-qr-secret-nur-fuer-tests \
          ACTIVITY_PHOTO_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
          CORS_ORIGINS=http://localhost:5173 PORT=5556 NODE_ENV=test \
          npm run dev

      `npm run dev` ist `node --watch`: Jede gespeicherte Backend-Datei
      startet den Server neu. Den `JWT_SECRET` in einfachen Anführungszeichen,
      sonst greift die Shell nach den Ausrufezeichen. Im Log müssen beim
      ersten Start 16 Zeilen `Migration applied` stehen (174 bis 195).
      **Steht dort `Database startup failed`, läuft der Server unter
      `NODE_ENV=test` ohne Migrationen weiter** — dann eine Backend-Datei
      speichern oder neu starten (so in der Probe: erster Start mit
      Zeitüberschreitung, zweiter mit allen 16 Migrationen). Mails und
      Push gehen lokal nicht raus; die Warnungen dazu sind richtig.

- [x] **4. Testdaten.** Erst wenn die Migrationen gelaufen sind, aus der
      Wurzel — derselbe Seed wie in `e2e/global-setup.ts`, samt den
      Jahrgängen der Admins:

          node -e "const {Pool}=require('pg');const {seed}=require('./backend/tests/helpers/seed.js');const p=new Pool({connectionString:'postgresql://postgres:postgres@localhost:5444/postgres'});seed(p).then(()=>p.query('INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES (4, 1), (8, 2) ON CONFLICT DO NOTHING')).then(()=>p.end()).then(()=>console.log('geseedet'))"

      Nur einmal je frischer Datenbank (der Seed legt feste IDs an). Konten
      und das gemeinsame Passwort stehen in `backend/tests/helpers/seed.js`:
      `orgadmin1` (Gemeindeleitung), `admin1` (Leitung, Jahrgang 1),
      `teamer1`, `konfi1`, dazu Gemeinde 2 mit `admin2` usw.

- [x] **5. Oberfläche** im zweiten Terminal, aus `frontend/`:

          VITE_API_URL=http://localhost:5556/api npm run dev

      Im Browser `http://localhost:5173` öffnen — genau diese Adresse, sie
      steht in `CORS_ORIGINS`. Jede gespeicherte Datei unter `frontend/src`
      erscheint ohne Neuladen.

- [x] **6. Ansehen.** Fenster mindestens 992 px breit, sonst zeigt der
      Browser die App-Fassung. Als `admin1` anmelden, „Konfis" → „Test Konfi
      1". Hell und dunkel prüfen (Systemeinstellung des Rechners).

      Der Seed ist dünn: keine Aktivitäten, keine Badges, keine Stempel.
      Was Simon sehen will, über die Oberfläche anlegen — als `admin1` bei
      „Test Konfi 1" Aktivitäten eintragen (vergibt die passenden Badges),
      ein Badge mit eigener Farbe unter „Mehr" anlegen, zwei Challenges
      für Jahrgang 1 stellen und als `konfi1` zu einer einen Beitrag
      schicken — das gibt einen erhaltenen und einen offenen Stempel (mit
      Freigabe-Pflicht erst, wenn `admin1` freigibt). Notfalls per SQL — nur
      gegen Port 5444, nie gegen Produktion.

**Ergebnis:** Simon sieht die Detailseite von „Test Konfi 1" mit
Aktivitäten, Bonuspunkten, Events, mindestens zwei Badges in verschiedenen
Farben und einem erhaltenen und einem offenen Stempel.

## 2. Spielregeln beim Bauen

Es gilt [CLAUDE.md](../../../CLAUDE.md). Für die Web-Fassung dazu:

- **Die App bleibt, wie sie ist.** Die Web-Fassung greift erst ab 992 px
  (`useBreitesLayout()`); unter der Breite rendert die App unverändert.
  Bausteine liegen in `frontend/src/components/web/`, das Aussehen je Bereich
  in `frontend/src/theme/web/*.css`.
- **Jede Detailseite** steht auf `components/web/WebDetailSeite.tsx`
  (Challenges auf `WebDetailInhalt`, weil sie eine IonPage halten): Zurück,
  Titel, Kennzeichen, alle Aktionen als Knöpfe oben rechts (die wichtigste
  rechts als Hauptknopf), Kennzahlen, links der Inhalt, rechts die Angaben.
  Keine eigene Aktionen-Karte, keine Sonderwege je Seite.
- **Liste oder Kacheln** über `WebAnsichtUmschalter` und `useAnsicht`; der
  Umschalter steht immer ganz rechts neben der Suche.
- **Farben nur als Tokens** (`var(--…)`), keine Hex- oder rgb-Werte — der
  Wächter `__tests__/components/webAnsichtCss.test.ts` fällt sonst. Die
  Rollenfarbe ist `--web-rolle`, die Farbe eines Badges kommt aus den Daten.
- **Eine Klasse, ein Stylesheet.** Alle Dateien unter `theme/web/` liegen
  im selben Bündel; `__tests__/components/webCssKlassen.test.ts` lässt keine
  neue Klasse in zwei Bereichen zu. Wer eine der bekannten Doppelungen
  behebt, streicht sie dort aus der Ausnahmeliste.
- **Zeitgeber in einem Ref halten und beim Verlassen der Seite löschen.**
  Sonst wird die CI rot, obwohl alle Tests grün sind („window is not
  defined"), siehe [offene-befunde.md](../../offene-befunde.md), „Tests und
  CI".
- **Im selben Commit:** Tests (Bugfix: erst der Test, der fällt; Gegenprobe:
  Änderung zurücknehmen, Test muss fallen), CHANGELOG unter
  `[Unreleased] - 2.4.0`, Handbuch, die drei Generatoren
  (`docs:api`, `docs:openapi`, `docs:handbuch`). Kein Backend, keine
  Antwortform, keine Migration ohne Rückfrage — ausgelieferte Apps lesen
  die API.
- **Vor dem Push** aus `frontend/`, wie die CI: `npx eslint .`,
  `npm run build`, `npm run typecheck:tests`, `npx vitest run`. Einzelne
  Dateien zwischendurch: `npx vitest run src/__tests__/components/leitung/webKonfiDetail.test.tsx`.
- **Branch und Merge:** eigener Branch von `main`, Pull Request, CI grün.
  Ein Merge nach `main` ist der Produktions-Deploy; den gibt Simon frei.
  Commits als Revisor01, Conventional Commits, ohne Verweise auf
  KI-Werkzeuge.

## 3. Erste Wünsche (Simon, 07.10.2026)

Alle vier Punkte betreffen die Detailseite einer Konfi für die Leitung,
`frontend/src/components/admin/web/leitung/WebKonfiDetail.tsx`. Wortlaut:
„konfi ansicht müssten events zwischen aktivitäten und bonuspunkte. badge
und stempel sollten gleich aussehen. badges in ihrer zugewiesenen farbe beim
hover bitte die info jeweils zeigen."

- [x] **a. Events zwischen Aktivitäten und Bonuspunkten.** Heute steht
      `EventPunkteKarte` rechts in `seite` (unter Badges). Sie wandert nach
      links in `haupt`, zwischen `AktivitaetenKarte` und `BonusKarte`. Bei
      einer Teamer:in steht rechts `TeamerEventsKarte` — ob sie analog
      zwischen Aktivitäten und Zertifikate rückt, Simon live zeigen und
      fragen.
      Test in `__tests__/components/leitung/webKonfiDetail.test.tsx`: In der
      Hauptspalte stehen die Überschriften in der Reihenfolge Aktivitäten,
      Events, Bonuspunkte; Gegenprobe.

- [x] **b. Badges und Stempel sehen gleich aus.** Heute:
      - Badges (`WebKonfiBadges.tsx`, Klassen `.web-badge*` in
        `theme/web/leitung.css`): Raster aus 48-px-Kreisen, Name darunter.
      - Stempel (`StempelKarte` in `WebKonfiKarten.tsx`, `.web-stempel*` in
        `leitung.css`): Liste mit 36-px-Kreis und zwei Textzeilen daneben.
      - **Achtung Doppelung:** `.web-stempel`, `__symbol` und `__text` gibt
        es auch in `theme/web/challenges.css` (dort eine Kachel mit Rahmen
        und Innenabstand). Auf der Personenseite greifen beide Regeln
        zugleich — vermutlich ein Teil dessen, was Simon stört. Die Klassen
        der Personenseite umbenennen und die Ausnahme in
        `webCssKlassen.test.ts` streichen.

      Ziel: eine Darstellung für beide Karten, z. B. dasselbe Raster aus
      Kreis und Name; erhaltene Stempel in der Challenge-Farbe, offene
      gedämpft. Für den Kreis gibt es schon `konfi/web/WebBadgeSymbol.tsx`
      (Badge-Seite der Konfis) — wiederverwenden statt einer dritten
      Fassung. Das Aussehen mit Simon live festlegen.

- [x] **c. Badges in ihrer Farbe.** Der Code setzt die Farbe schon
      (`getBadgeColor(b)` als Hintergrund des Kreises). Sieht Simon trotzdem
      eine einheitliche Farbe, erst nachsehen, was
      `GET /admin/konfis/:id/badges` bzw. `/teamer/:id/badges` in
      `earned[].color` liefert — nicht raten. Ein lokal angelegtes Badge mit
      eigener Farbe zeigt es.

- [x] **d. Info beim Darüberfahren.** Heute steht die Info nur im
      `title`-Attribut: Der Browser zeigt sie spät, ungestaltet und nicht
      per Tastatur. Gewünscht: beim Darüberfahren **und** beim Fokus eine
      sichtbare Info — Badge: Name, Beschreibung bzw. Kriterium, „erreicht
      am"; Stempel: Challenge, Beschreibung, „erhalten am" bzw. „noch nicht
      erhalten". Die Texte gibt es schon in der App:
      `shared/BadgePopoverContent.tsx` und `shared/StempelPopoverContent.tsx`
      — von dort nehmen. Der Eintrag muss fokussierbar sein, die Info über
      `aria-describedby` angebunden; auf einem Tablet ab 992 px öffnet sie
      ein Tippen. Tests: Info erscheint bei Hover und Fokus, verschwindet
      beim Verlassen; Gegenprobe.

Für a bis d: Handbuch
[30-leitung.md](../../handbuch/30-leitung.md#im-browser-die-detailseite-einer-person-nutzen)
(Absätze „Links folgen …" und „Rechts stehen …"), CHANGELOG unter
„Geändert", Generatoren. Keine Route betroffen, also keine API-Doku.

**Ergebnis:** je Punkt Commit-Hash und eine Zeile, was Simon abgenommen hat.
*Erledigt 07.10.2026:* a bis d mit #229 (`fb07f831`), live mit Simon gebaut
und abgenommen; Einzelheiten unter 5.

## 4. Zur Einordnung, nicht Teil des Auftrags

Steht in [offene-befunde.md](../../offene-befunde.md) und wird erst auf
Simons Wort angefasst: die übrigen CSS-Doppelungen, die Zeitgeber-Kandidaten,
die zweizeilige Filterzeile der Challenges und die Frage nach einer
gemeinsamen Stelle für Beschriftungen, Reiter und Filter von App und
Web-Fassung.

## 5. Stand und Wieder aufnehmen (07.10.2026)

**Erledigt und gemergt** (CHANGELOG `[Unreleased] - 2.4.0`):
- #229: Personenseite (Events links, gleiche Spaltenbreiten, Badges/Stempel
  als ein Raster mit Info bei Hover/Fokus), Stempel in den Challenges gleich,
  Kacheln von Konfis/Team/Events auf `WebBildKarte` (Titel bzw. Name im Kopf),
  Angaben immer mit Symbol (`components/web/angabeSymbole.ts`), Merkmale als
  farbige Chips; behoben: weiße Detailseite beim ersten Klick, Teamer-Events
  „gebucht = anwesend“ (`teamerEvents[].attendance_status`, additiv).
- #230: alle Tabellen per Spaltenkopf sortierbar (`sortWert`,
  `utils/tabelleSortieren.ts`), Aktivitäten (Mehr) und gemeldete Aktivitäten
  (Mitmachen) als Liste/Kacheln, Teilnehmerliste mit kompakten
  Anwesenheitsknöpfen, `PUT /admin/activities/requests/:id` antwortet vor
  den Pushes (1230 → 27 ms lokal, Pushes verzögert).

**Bauregeln, die dabei entstanden sind:**
- Jede Kachel ist `WebBildKarte` (`components/web/`); keine eigene Kartenform.
- Jede Detailseite gibt in allen Zuständen `WebDetailSeite` zurück (`zustand`
  für Laden/Fehler) — nie zwischendurch `WebSeite`, sonst bleibt die Seite
  nach dem Übergang unsichtbar. Wächter: `webDetailSeiteEinGeruest.test.ts`.
- Neue Angaben-Bezeichnung → Eintrag in `angabeSymbole.ts`.
- Neue Tabellenspalte → `sortWert` mitgeben.
- Den farbigen Kreis im Kartenkopf (wie `app-section-icon`) will Simon nicht.

**Offen bei Simon:** fachliche Reihenfolge der Status-Spalten; Punkte-Verlauf
vor dem Kürzen sortieren (beides in `docs/offene-befunde.md`).

**Wieder aufnehmen:** die Schritte aus Teil 1. Die Fallen dabei — Port 5556
statt 5555 wegen des Android-Emulators, Node 26 neben einem älteren
Standard-`node`, Backend-Tests nie gegen die Datenbank der Vorschau — stehen
in [wissen/lokal-entwickeln.md](../../wissen/lokal-entwickeln.md). Läuft
`konfi-quest-e2e-db-1` noch, sind die Testdaten da (Seed plus Aktivitäten,
Badges, Stempel, Pflicht- und Team-Events, gemeldete Aktivitäten
„Messung …“); nach einem Neustart von Docker Seed und Daten neu anlegen wie
in Teil 1.
