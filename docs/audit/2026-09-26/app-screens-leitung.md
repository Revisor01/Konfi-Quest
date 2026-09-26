# Audit Fachliche Screens der Leitung und Organisationsverwaltung — 26.09.2026

## Umfang und Methode

**Geprüft** (gelesen, gegen Backend-Routen und Handbuch abgeglichen, wo möglich
ausgeführt):

- `frontend/src/components/admin/pages/*` (18 Seiten), `admin/views/*`
  (KonfiDetail*, EventDetail*, ChallengesManageView, KonfiBadgesSection),
  `admin/modals/*` (28 Modale), `admin/KonfisView.tsx`, `EventsView.tsx`,
  `UsersView.tsx`, `OrganizationView.tsx`, `ActivityRequestsView.tsx`,
  `BadgesView.tsx`, `ActivitiesView.tsx` sowie `components/shared/*`
  (AppKopfzeile, OrgSwitcherButton, EinladungenKarte, QRDisplayModal,
  ChallengesPage u. a.). Zusammen rund 29 000 Zeilen.
- Backend-Gegenstücke: `backend/routes/*.js`, `routes/events/*.js`,
  `middleware/rbac.js`, `utils/roleHierarchy.js`, `utils/konfiDeletion.js`,
  `utils/badgeKategorieRegel.js`, `utils/badgeEventRule.js`, `utils/apm.js`,
  `createApp.js` (Metrik-Routen).
- Sollverhalten: `docs/handbuch/30-leitung.md`, `35-passwoerter.md`,
  `45-jahrgaenge.md`, `40-punkte.md`, `60-badges.md`, `70-termine.md`,
  `80-challenges.md`, `05-rollen.md`; `docs/api/*.yaml`.

**Methode:**

1. Alle 177 `api.get/post/put/delete/patch`-Aufrufe der Admin- und
   Shared-Komponenten extrahiert (Regex) und gegen die 251 im Backend
   registrierten Routen abgeglichen (Pfad, Methode). Für jede GET-Route die
   `res.json(...)`-Form (Array/Objekt) gegen die Lesestelle im Frontend
   (`.map`, `.filter`, `?.earned`, `Array.isArray`) geprüft.
2. Routentabellen ohne Datenbank ausgelesen (Router-Fabrik mit Stub-DB laden
   und `router.stack` ausgeben; Skript im Scratchpad).
3. `npx tsc --noEmit` (20,5 s, Exit 0) und `npx eslint src/components/admin
   src/components/shared --max-warnings=0` (36,9 s, Exit 1 — 6 Fehler,
   154 Warnungen).
4. Zwei temporäre Vitest-Tests geschrieben, ausgeführt und gelöscht:
   Render-Messung der Listen mit 300 Konfis / 50 Jahrgängen / 100 Terminen
   sowie Verhalten von `useOfflineQuery` beim Schlüsselwechsel.
5. Commits 5f151b1, f770270, 878ca24, 1243d6b, 54b0d88, b85ab19 gegen den
   heutigen Code nachgelesen.

**Bewusst nicht geprüft:** Kein Datenbank-Port zugewiesen, daher keine
Backend-Tests mit echter Datenbank — SQL-Filter sind „aus Code gelesen".
Chat-Moderation (eigener Bereich). Konfi- und Teamer-Ansichten (eigene
Bereiche). Optik/Screenshots.

## Zusammenfassung

15 Befunde: 0 KRITISCH, 1 HOCH, 4 MITTEL, 10 NIEDRIG. Der Routen- und
Formabgleich (Schwerpunkt 1) hält vollständig: Kein Aufruf liest eine andere
Antwortform, als das Backend liefert; ein Vorfall wie am 29.08.2026 ist in
diesem Bereich heute nicht angelegt. Der gewichtigste Befund liegt im neuen
Einladungsfluss für bestehende Personen (Commit f770270): Wer eine Einladung
annimmt, erscheint in **Mehr › Benutzer:innen** der einladenden Gemeinde nicht,
weil `GET /users` nur die Stamm-Gemeinde listet — eingeladene Admins und
Teamer:innen können dort keine Jahrgänge bekommen und sehen in der neuen
Gemeinde keine Konfis. Außerdem kann eine Einladung in der App weder
eingesehen noch zurückgezogen werden, obwohl das Handbuch beides verspricht.
Drittens fehlt an Terminen eine Prüfung „Ende vor Anfang" auf beiden Seiten;
so ein Termin landet sofort unter „Vergangen".

## Release-Empfehlung für den Bereich

**mit Auflage.** Der Bereich ist funktional und vertragskonform gegenüber den
Store-Apps; die Auflage betrifft den mit 2.3.0 neuen Einladungsfluss:
**BF-01 vor dem Release schließen** (`GET /users` und `PUT /users/:id` auf
beide Zugehörigkeitsquellen erweitern, wie `GET /users/:id` und
`POST /users/:id/jahrgaenge` es seit 26.09. tun) — oder den Einladungsknopf
für 2.3.0 zurückhalten. BF-02 bis BF-05 sollten in 2.3.x folgen.

## Befunde

### BF-01: Eingeladene Personen fehlen in „Benutzer:innen" und lassen sich dort nicht bearbeiten

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — `GET /users` liest beide Quellen (Rolle und Jahrgangszähler je Gemeinde, additives Feld `mitgliedschaft` = `stamm`/`weitere`); `PUT /users/:id` ändert für Zusatzmitglieder nur die Rolle in `user_organizations` (Kontofelder → 400 `nur_rolle_in_weiterer_gemeinde`); `DELETE /users/:id` beendet für sie die Mitgliedschaft samt Jahrgängen dieser Gemeinde statt das Konto zu löschen. Oberfläche: Vermerk in der Liste, gesperrte Kontofelder mit Hinweis im Dialog, angepasster Lösch-Dialog. Tests in `users.test.js` (9) und `benutzerlisteWeitereGemeinde.test.tsx`.
- **Fundstelle:** `backend/routes/users.js:97` (GET /), `backend/routes/users.js:288`
  (PUT /:id); Aufrufer `frontend/src/components/admin/pages/AdminUsersPage.tsx:34-38`,
  `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx:167-172`,
  `frontend/src/components/admin/modals/UserManagementModal.tsx:219,291`
- **Kennzeichnung:** aus Code gelesen (SQL-Filter; kein DB-Port zugewiesen).
  Gegenstück belegt: `users.js:119-141` und `:660-685` sowie
  `utils/roleHierarchy.js:96-118` kennen seit 26.09.2026 beide Quellen.
- **Beschreibung:** Commit f770270 lässt einen Org-Admin eine bestehende Person
  einladen; nach Annahme steht die Mitgliedschaft in `user_organizations`. Die
  Benutzerliste filtert aber weiterhin `WHERE u.organization_id = $1` — nur
  Konten, deren Stamm-Gemeinde die aktive ist. Die Detailroute und die
  Jahrgangszuweisung wurden am 26.09. auf beide Quellen erweitert, die Liste
  (der einzige UI-Weg zur Detailansicht) und die Bearbeitungsroute nicht.
  Dasselbe gilt für die zweite Zuweisungsstelle beim Jahrgang-Anlegen
  (`AdminJahrgaengeePage`), die ebenfalls `GET /users` lädt.
- **Auswirkung aus Nutzersicht:** Der Org-Admin lädt eine Admin oder
  Teamer:in ein, die Person nimmt an — und ist danach in **Mehr ›
  Benutzer:innen** unsichtbar. Das Handbuch sagt (30-leitung.md:66-67,
  05-rollen.md:152-160), genau dort vergebe man Rolle und Jahrgänge. Ohne
  Jahrgang bleibt für die eingeladene Admin die Konfi-Liste leer („Kein
  Jahrgang zugewiesen"), eine eingeladene Teamer:in erreicht keine Konfi. Der
  Einladungsfluss ist damit für diese beiden Rollen nur zur Hälfte benutzbar;
  nur eingeladene Org-Admins (ohne Jahrgangsbindung) sind sofort arbeitsfähig.
  Einzige Umgehung: der Super-Admin über
  `OrganizationManagementModal` › Mitglieder.
- **Beleg:**
  ```sql
  -- users.js:88-100 (GET /users)
  FROM users u ... WHERE u.organization_id = $1 AND r.name NOT IN ('konfi', 'super_admin')
  -- users.js:288 (PUT /users/:id)
  SELECT id FROM users WHERE id = $1 AND organization_id = $2  -- 404 für user_organizations-Mitglied
  ```
  Kein Test in `backend/tests/routes/einladungen.test.js` prüft `GET /users`
  nach der Annahme (18 Fälle, keiner ruft die Liste).
- **Empfehlung:** `GET /users` per UNION über `users.organization_id` und
  `user_organizations` (Rolle je Gemeinde aus `uo.role_id`, wie in
  `utils/orgMitglieder.js`); `PUT /users/:id` auf dieselbe Prüfung wie
  `POST /:id/jahrgaenge` umstellen, dabei `role_id` für Zusatzmitglieder in
  `user_organizations` schreiben, nie in `users.role_id`. Test: Einladung
  annehmen → Person steht in `GET /users` der einladenden Gemeinde.

### BF-02: Einladungen lassen sich in der App weder einsehen noch zurückziehen

- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/einladungen.js:182` (GET /), `:199` (DELETE /:id)
  ohne Aufrufer; `docs/handbuch/05-rollen.md:169-170`
- **Kennzeichnung:** reproduziert —
  `grep -rn "einladungen" frontend/src --include=*.tsx --include=*.ts | grep -v __tests__`
  liefert nur `POST /einladungen` (EinladungModal.tsx:84),
  `GET /einladungen/meine` und `POST /einladungen/:id/{annehmen,ablehnen}`
  (EinladungenKarte.tsx:44,57).
- **Beschreibung:** Das Backend bietet Liste und Rückzug offener Einladungen
  (mit Test „die Leitung zieht eine Einladung zurueck"). Im Frontend gibt es
  dafür keine Oberfläche. Das Handbuch verspricht: „Die Einladung gilt 14 Tage
  und lässt sich zurückziehen, solange sie offen ist."
- **Auswirkung aus Nutzersicht:** Wer die falsche Rolle wählt oder die falsche
  Person trifft, kann 14 Tage lang nichts tun — eine zweite Einladung weist das
  Backend ab („keine zweite offene Einladung"). Der Org-Admin sieht auch nicht,
  ob eine Einladung noch offen ist oder angenommen wurde.
- **Beleg:** siehe grep oben; `einladungen.test.js:145`.
- **Empfehlung:** In `AdminUsersPage` einen Abschnitt „Offene Einladungen"
  (GET /einladungen) mit Wisch „Zurückziehen" (DELETE) — oder den Handbuchsatz
  streichen.

### BF-03: Termin mit Ende vor Anfang wird nirgends abgewiesen

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/components/admin/modals/EventModal.tsx:203-208`
  (Prüfungen), `:621-624` (Ende-Picker ohne `min`);
  `backend/routes/events/verwaltung.js:42-53` (validateCreateEvent),
  `:72-160`; `backend/routes/events/validierung.js`;
  `frontend/src/components/shared/eventFormatting.ts:46-53`
- **Kennzeichnung:** aus Code gelesen —
  `grep -rn -i "end_time.*<\|<.*end_time\|ende vor\|endet vor" backend/routes/events backend/middleware frontend/src/components/admin/modals/EventModal.tsx frontend/src/components/admin/modals/EventFormSections.tsx`
  findet keine Vergleichsstelle.
- **Beschreibung:** Das Formular prüft Name, Datum und Pflicht-ohne-Jahrgang;
  das Backend prüft Teamer-Kontingent, Anmeldeschluss, Pflicht-ohne-Jahrgang
  (Commit 5f151b1) und Org-Zugehörigkeit. Weder Formular noch Backend prüfen
  `event_end_time >= event_date`. Der Ende-Picker hat kein `min`.
- **Auswirkung aus Nutzersicht:** Wer beim Ende versehentlich einen früheren
  Tag wählt, speichert ohne Warnung. `eventEnde()` nimmt das Ende; die
  Leitungsliste sortiert den Termin sofort unter „Vergangen"
  (`EventsView.tsx:92-100`), er verschwindet aus „Aktuell", die Konfis sehen ihn
  als vorbei. Der Anmeldeschluss-Vorschlag rechnet vom Beginn — der Termin
  wirkt gleichzeitig „offen" und „vorbei".
- **Beleg:** `validateCreateEvent` (verwaltung.js:42-53) enthält nur name,
  event_date, mandatory, is_konfirmation, bring_items, max_participants.
- **Empfehlung:** Im Formular `min={formData.event_date}` am Ende-Picker und
  eine Meldung „Das Ende liegt vor dem Beginn"; im Backend dieselbe Regel in
  `validierung.js` (für POST /, PUT /:id, POST /series) mit Test.

### BF-04: Einzelner Antrag lädt die gesamte Antragshistorie der Gemeinde

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/components/admin/modals/ActivityRequestModal.tsx:85-87`,
  `frontend/src/components/admin/views/KonfiDetailView.tsx:430`,
  `frontend/src/components/admin/pages/AdminEventsPage.tsx:129`;
  `backend/routes/activities.js:335-400`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** `GET /admin/activities/requests` kennt einen
  `?status=`-Filter, aber kein LIMIT und keine Pagination; genehmigte Anträge
  werden nie gelöscht (nur abgelehnte, `activities.js:419`). Der Antragsdialog
  lädt beim Öffnen **eines** Antrags die komplette Liste ohne Filter und sucht
  mit `.find()` den einen heraus, obwohl die aufrufende Seite das Objekt schon
  hat. Die Konfi-Detailansicht lädt dieselbe Gesamtliste, um die Anträge einer
  einzelnen Person zu finden.
- **Auswirkung aus Nutzersicht:** Pro Öffnen eines Antrags oder einer
  Konfi-Detailseite wandert die gesamte Antragshistorie der Gemeinde über die
  Leitung — sie wächst mit jedem Jahr. Bei 300 Konfis und mehreren Jahrgängen
  spürbar auf dem Handy, im Zug erst recht.
- **Beleg:** `activities.js:379-389` — `SELECT ar.*, ... ORDER BY ar.created_at DESC`
  ohne LIMIT; `ActivityRequestModal.tsx:85-87`:
  `const response = await api.get('/admin/activities/requests'); ... requests.find(r => r.id === requestId)`.
- **Empfehlung:** Dem Dialog das Antragsobjekt übergeben (oder
  `GET /admin/activities/requests/:id` anlegen — additiv); in der
  Detailansicht `?user_id=` als neuen optionalen Filter; Liste standardmäßig
  auf `pending` + letzte 90 Tage. Größe siehe „Auf Produktion nachzumessen".

### BF-05: Hinweis beim Konfi-Anlegen verspricht, das Passwort sei später einsehbar

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/components/admin/modals/KonfiModal.tsx:295`;
  Gegenstücke `backend/routes/konfi-management.js:215-216` (bcrypt),
  `:599-697` (nur Neu-Generieren), `frontend/src/components/admin/views/KonfiDetailView.tsx:607-637`;
  `docs/handbuch/35-passwoerter.md:30-33`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der Hinweis lautet: „Du kannst das Passwort später in der
  Detailansicht einsehen oder zurücksetzen." Das Passwort wird gehasht
  gespeichert und ist nirgends abrufbar; die Detailansicht bietet nur ein neues
  Einmalpasswort. Das Handbuch sagt es richtig: „es steht danach nirgends mehr,
  auch du kannst es nicht noch einmal abrufen."
- **Auswirkung aus Nutzersicht:** Wer dem Hinweis vertraut, tippt den
  Passwort-Dialog mit „Fertig" weg, ohne zu kopieren, und muss später ein neues
  erzeugen — hat der Konfi das erste schon, ist es ungültig.
- **Beleg:** `KonfiModal.tsx:295` vs. `35-passwoerter.md:31-33`.
- **Empfehlung:** Text ändern: „… Das Passwort wird dir einmal angezeigt —
  danach kannst du nur ein neues erzeugen."

### BF-06: Toter Aufruf `GET /admin/jahrgaenge/:id` vor jeder Passwortanzeige

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/pages/AdminKonfisPage.tsx:257,346-361`;
  `backend/routes/jahrgaenge.js` (keine GET-/:id-Route)
- **Kennzeichnung:** reproduziert — Routentabelle ohne DB:
  `JWT_SECRET=x node scratchpad/app-screens-leitung/routentabelle.js routes/jahrgaenge.js`
  → `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /:id/attendance-matrix`,
  `GET /:id/sprueche`, `POST /:id/matrix-email`. Kein `GET /:id`.
- **Beschreibung:** Nach dem Anlegen ruft `createOrJoinJahrgangChat` erst
  `GET /admin/jahrgaenge/${id}` (404), der Fehler wird geschluckt, `POST /chat/rooms`
  läuft nie. Der Jahrgangs-Chat wird ohnehin im Backend synchronisiert
  (`konfi-management.js:299`). Der Aufruf steht **vor** dem Passwort-Dialog
  (`await` in Zeile 257).
- **Auswirkung aus Nutzersicht:** Ein zusätzlicher fehlgeschlagener
  Roundtrip, bevor das Einmalpasswort erscheint; im Betriebs-Dashboard je
  Konfi-Anlage ein 404 im Fehlerprotokoll (`apm.js:331-337`).
- **Empfehlung:** `createOrJoinJahrgangChat` samt Aufruf entfernen.

### BF-07: Toter Aufruf `GET /organizations/:id` bei jedem Öffnen der Konfi-Liste

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/KonfisView.tsx:93-112`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** `const [, setKonfiLimit] = useState(...)` — der Wert wird
  gesetzt, aber nie gelesen. Der Effekt lädt trotzdem bei jedem Mount die
  Organisation samt sechs Zählabfragen (`organizations.js:203-276`).
- **Auswirkung aus Nutzersicht:** Eine unnötige Anfrage pro Öffnen der
  Konfi-Liste; die versprochene „X von Y Konfis"-Anzeige gibt es nicht.
- **Empfehlung:** Effekt entfernen oder die Anzeige bauen.

### BF-08: Handbuch nennt vier Seiten ohne Gemeinde-Umschalter — es sind alle Unterseiten

- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/handbuch/30-leitung.md:17-19`, `docs/handbuch/05-rollen.md:180-186`;
  Code: alle `AppKopfzeile`-Aufrufe in `admin/pages/*` außer Konfis, Events,
  Mehr tragen `gemeindeUmschalter={false}` (Commit 878ca24)
- **Kennzeichnung:** reproduziert — `grep -n "<AppKopfzeile" -A4 frontend/src/components/admin/pages/*.tsx | grep gemeindeUmschalter`
  zeigt 15 Seiten mit `false`; Handbuch nennt vier.
- **Beschreibung:** Commit 878ca24 („Handbuch nachgezogen") hat die Regel
  geändert (Umschalter nur auf den drei Reitern), die beiden Handbuchstellen
  behaupten weiter, nur Profil, Benutzer:innen, Organisationen und Betrieb
  trügen ihn nicht.
- **Auswirkung aus Nutzersicht:** Wer im Handbuch nachliest, sucht auf
  Aktivitäten/Badges/Jahrgänge einen Umschalter, den es nicht gibt.
- **Empfehlung:** Beide Stellen auf die Regel „nur Konfis, Termine, Mehr"
  umschreiben; Generator laufen lassen.

### BF-09: Handbuch: Teamer-Abzeichen „Pflicht-Anwesenheit" würde weiter vergeben — das Backend kennt den Fall nicht

- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/handbuch/60-badges.md:323,333-336`;
  `backend/routes/badges.js:486-660` (Teamer-Zweig)
- **Kennzeichnung:** reproduziert —
  `sed -n '440,660p' backend/routes/badges.js | grep -n mandatory_event_count` → leer;
  Fälle im Teamer-Zweig: activity_count, event_count, streak,
  activity_combination, teamer_year, specific_activity, category_activities,
  category_combination, unique_activities, time_based.
- **Beschreibung:** Das Handbuch sagt für „Pflicht-Anwesenheit" bei
  Teamer:innen „nur im Bestand" und erklärt: „Ein Abzeichen dieser Art, das es
  schon gibt, wird aber weiterhin ganz normal vergeben." Für `event_count`,
  `streak`, `time_based` stimmt das; für `mandatory_event_count` gibt es im
  Teamer-Zweig keinen Fall — ein solches Bestandsabzeichen wird nie vergeben.
  Der Kriterien-Editor selbst ist mit dem Backend deckungsgleich
  (`TEAMER_HIDDEN_TYPES` in `BadgeManagementModal.tsx:111-112`; Konfi-Zweig
  wertet alle 15 angebotenen Typen aus, Teamer-Zweig alle 7 angebotenen).
- **Auswirkung aus Nutzersicht:** Nur, falls so ein Abzeichen existiert (siehe
  „Auf Produktion nachzumessen"): Es wird nie verliehen, die Leitung sucht den
  Fehler bei sich.
- **Empfehlung:** Handbuchsatz auf die drei tatsächlich ausgewerteten Typen
  eingrenzen oder den Fall im Teamer-Zweig ergänzen.

### BF-10: Löschwarnung für Konfis nennt nicht alles, was verschwindet; Handbuch ohne Abschnitt

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/pages/AdminKonfisPage.tsx:188`;
  `backend/utils/konfiDeletion.js:33-160`; `docs/handbuch/30-leitung.md`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Die Warnung nennt „Punkte, Abzeichen, Aktivitäten und
  Chat-Nachrichten". `deleteKonfiCascade` löscht zusätzlich Termin-Buchungen
  (mit Nachrücken der Warteliste), Anträge samt Nachweisfotos,
  Challenge-Beiträge samt Dateien, Zertifikate, Postfach, Push-Tokens. Das
  Handbuch-Kapitel der Leitung hat keinen Abschnitt zum Löschen eines Konfis
  (`grep -n -i "löschen" docs/handbuch/30-leitung.md` trifft nur Chat,
  Termine, Material, Jahrgang).
- **Auswirkung aus Nutzersicht:** Die Leitung weiß nicht, dass mit dem Konfi
  auch dessen Challenge-Beiträge aus der Galerie verschwinden und
  Wartelistenplätze nachrücken.
- **Empfehlung:** Warntext um „Termin-Anmeldungen, Challenge-Beiträge und
  hochgeladene Fotos" ergänzen; Handbuchabschnitt „Einen Konfi löschen".

### BF-11: `useOfflineQuery` zeigt beim Schlüsselwechsel alte Daten bis zur neuen Antwort

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/hooks/useOfflineQuery.ts:160-215` (kein
  `setData(null)`/`setLoading(true)` beim Wechsel von `cacheKey`);
  betroffen `AdminBadgesPage.tsx:51` (`…:${selectedRole}`),
  `AdminActivitiesPage.tsx:47`, `AdminMaterialPage.tsx:116`
- **Kennzeichnung:** reproduziert — temporärer Hook-Test
  (renderHook, Schlüssel `admin:konfis:1` → `admin:konfis:2`, Antwort für 2
  ausstehend): `data` = `["Konfi aus Gemeinde 1"]`, `loading` = false. Test
  gelöscht.
- **Beschreibung:** Beim **Gemeindewechsel** greift das nicht: `switchOrg`
  erhöht `orgVersion`, `<IonReactRouter key={orgVersion}>` (App.tsx:240) baut
  den Seitenbaum neu, alle Hooks starten leer (geprüft und in Ordnung). Es
  greift aber bei Schlüsselwechseln **innerhalb** einer Seite: Beim Umschalten
  Konfi ↔ Teamer:innen auf Badges/Aktivitäten steht die alte Liste, bis die
  neue geantwortet hat; scheitert die Antwort, bleibt sie als „stale" stehen.
- **Auswirkung aus Nutzersicht:** Kurz die falsche Liste unter dem neuen
  Reiter; bei schlechtem Netz länger.
- **Empfehlung:** Im Initial-Effekt bei Schlüsselwechsel `setData(null)`
  und `setLoading(true)`, bevor der Cache gelesen wird.

### BF-12: Betriebs-Dashboard speichert und zeigt Roh-URLs samt Query-String

- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/utils/apm.js:333,344`;
  `frontend/src/components/admin/pages/AdminMetricsPage.tsx:649,663`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Routen werden normalisiert (`:id`, `:name`, `:code`), die
  Nutzer-IDs gehasht — aber `recentErrors[].url` und `beispielUrl` halten
  `req.originalUrl` roh, inklusive Query. Bei einem 4xx/5xx auf
  `/api/organizations/search-users?q=<Name>` oder
  `/api/auth/check-username/<name>` (429) steht der Suchbegriff bzw. der
  Benutzername im Fehlerprotokoll, sichtbar für Super-Admins.
- **Auswirkung aus Nutzersicht:** Nur Super-Admins sehen es; für Konfis
  (Minderjährige) dennoch Datenminimierung: der Benutzername ist meist der
  Klarname.
- **Empfehlung:** Query-String abschneiden und dieselbe Normalisierung wie für
  `route` anwenden, bevor die URL gespeichert wird.

### BF-13: ESLint-Fehler in Admin-Dateien

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/pages/AdminEventsPage.tsx:13:10,654:16`;
  `admin/views/EventDetailSections.tsx:161:3`; `admin/views/EventDetailView.tsx:8:3,300:16`;
  `shared/PushAuswahl.tsx:14:3`
- **Kennzeichnung:** reproduziert —
  `cd frontend && npx eslint src/components/admin src/components/shared --max-warnings=0`
  → 6 Fehler (`@typescript-eslint/no-unused-vars`), 154 Warnungen
  (55× react-hooks/refs, 27× react-refresh/only-export-components, 26×
  set-state-in-effect, 23× exhaustive-deps, 17× immutability), Exit 1.
- **Beschreibung:** Die CI lintet nur geänderte Dateien
  (`.github/workflows/ci.yml:178`), deshalb bleibt sie grün.
- **Auswirkung aus Nutzersicht:** keine.
- **Empfehlung:** Die sechs ungenutzten Importe/Variablen entfernen.

### BF-14: Listen ohne Virtualisierung — Renderzeit wächst linear

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/KonfisView.tsx:154-170`,
  `EventsView.tsx:92-100`
- **Kennzeichnung:** reproduziert — temporärer Vitest-Test (jsdom, 3 Läufe,
  Median), gelöscht:

  | Liste | Zeilen | Median | Vergleich |
  |---|---|---|---|
  | KonfisView | 300 Konfis / 50 Jahrgänge | 1 798 ms | 30 Konfis: 175 ms |
  | EventsView | 100 Termine | 416 ms | 10 Termine: 31 ms |

- **Beschreibung:** Beide Listen rendern alle Zeilen als `ion-item-sliding`;
  Suche, Jahrgangsfilter und Sortierung laufen im Speicher (vorhanden). Keine
  Pagination, kein Fenster. Die jsdom-Zahlen sind keine Gerätezeiten; sie
  zeigen die Linearität (Faktor 10 bei 10× Zeilen).
- **Auswirkung aus Nutzersicht:** Bei 300 Konfis in einer Gemeinde spürbare
  Wartezeit beim Öffnen und beim Tippen im Suchfeld (jeder Tastendruck
  filtert und rendert neu). Bei den heute typischen 20–60 Konfis pro Gemeinde
  ohne Folge.
- **Empfehlung:** Erst auf Produktion messen (Gerät, größte Gemeinde). Falls
  nötig: `IonInfiniteScroll` oder Jahrgangsfilter als Vorgabe.

### BF-15: Weg zum Anlegen einer neuen Gemeinde ist nirgends dokumentiert

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/admin/modals/OrganizationManagementModal.tsx:380-490`;
  `backend/routes/organizations.js:284-632`; `docs/handbuch/*`, `docs/wissen/*`
- **Kennzeichnung:** reproduziert —
  `grep -rli "organisation anlegen\|gemeinde anlegen" docs/` → keine Treffer.
- **Beschreibung:** Der Weg ist funktionsfähig (Super-Admin: Mehr › Gebäude-Symbol ›
  Plus; Pflichtfelder Name, Systemname, Anzeigename, Erst-Admin mit
  Benutzername/Passwort nach Policy, Konfi-Limit) und serverseitig gut
  gesichert (`requireSuperAdmin`, `validateCreateOrg`, Passwort-Policy). Für
  die EKD-Ausrollung fehlt eine Anleitung, welche Felder wie zu füllen sind
  (Systemname/Slug, Limit, Testphase) und was danach zu tun ist (Erst-Admin
  meldet sich an, legt Jahrgang an, lädt Team ein).
- **Auswirkung aus Nutzersicht:** Wer die Ausrollung übernimmt, muss es sich
  aus dem Dialog erschließen.
- **Empfehlung:** Kurzer Abschnitt in `docs/wissen/` (nicht Handbuch — die
  Seite sieht nur der Super-Admin).

## Unklar

- **Registrierungs-URL fest auf `https://konfi-quest.de`**
  (`AdminInvitePage.tsx:122,152`): Sollte eine Landeskirche unter eigener Domain
  laufen, zeigen alle QR-Codes weiter auf konfi-quest.de. Ob je eine zweite
  Domain geplant ist, geht aus dem Repo nicht hervor.
- **Größe der Antragsliste in Produktion** (BF-04): Zeilenzahl pro Gemeinde
  und Antwortgröße konnte ich ohne Datenbank nicht messen.
- **Gerätezeit der Listen** (BF-14): jsdom-Zahlen sind kein Gerätemaß.
- **Existenz eines Teamer-Abzeichens mit `mandatory_event_count`** (BF-09).

## Alte Befunde nachgeprüft

`docs/offene-befunde.md` enthält für diesen Bereich nur Nr. 13 (Teamer-Termin-
Aktionen, „Umbau läuft") — betrifft die Teamer-Oberfläche, nicht die Leitung;
nicht mein Bereich. Datierte Code-Kommentare in meinem Bereich:

| Kommentar / Commit | Stand heute |
|---|---|
| Rollen-Bericht Nr. 16 (26.08.): `/admin/users` UI-Gate nur am Knopf | **behoben bestätigt** — `AdminUsersPage.tsx` reicht `darfVerwalten={user?.role_name === 'org_admin'}` an die Liste; Test `benutzerseiteRollenGate.test.ts` |
| Audit-Befund C3 (25.09.): Umschalter nur auf AdminKonfisPage | **behoben bestätigt** — gemeinsame `AppKopfzeile`, Regel „nur drei Reiter" (878ca24); Handbuch hinkt nach (BF-08) |
| 31.08./01.09.: Admin legt Konfi in fremdem Jahrgang an, sieht sie nie | **behoben bestätigt** — `darfJahrgang(req, jahrgang_id, {edit:true})` in POST (konfi-management.js:243-246) und PUT (:401-413); KonfiModal warnt zusätzlich (`verliertSicht`) |
| 27.08.: PUT /admin/konfis/:id ohne Org-Prüfung des Ziel-Jahrgangs | **behoben bestätigt** — konfi-management.js:388-394 |
| 08.09.: Passwort-Reset für Teamer:innen 404 | **behoben bestätigt** — konfi-management.js:630-636 lässt `konfi` und `teamer` zu; Handbuch 35 stimmt |
| 14.09.: Passwort-Reset beendet Sitzungen nicht | **behoben bestätigt** — `token_invalidated_at`, Refresh-Tokens widerrufen, Push-Tokens gelöscht (konfi-management.js:653-672) |
| 26.09. (5f151b1): Pflichttermin ohne Jahrgang | **behoben bestätigt** — Backend 400 mit `error_code`, Formular prüft vorab (EventModal.tsx:205-208) und zeigt Backend-`error`/`details` an (:322-332) |
| 26.09. (f770270): Einladung bestehender Person | **teilweise** — Fluss bis zur Annahme in Ordnung; danach BF-01, BF-02 |
| 15.09.: Absage mit Grund (Migration 152) | **behoben bestätigt** — `TerminAbsagenModal` mit Modus absagen/grund, eigene Route `/absagegrund` für abgesagte Termine (AdminEventsPage.tsx:200-221) |
| 25.09. (b85ab19): Zähler folgen der aktiven Gemeinde | **behoben bestätigt** — `badgeGemeindeWechsel.test.tsx` (448 Zeilen), OrgSwitcher lädt `badge-counts/je-organisation` beim Öffnen |

## Geprüft und in Ordnung

- **Routen- und Formabgleich (Schwerpunkt 1):** 177 Frontend-Aufrufe gegen
  251 Backend-Routen — alle vorhanden bis auf BF-06. Jede Array-Lesestelle
  (`.map/.filter`) trifft eine Route, die `rows`/`[]` liefert; jede
  Objekt-Lesestelle (`?.earned`, `.snapshots`, `.max_konfis`, `.checked_in`)
  eine Objektroute. `GET /admin/konfis/:id/badges` und `/teamer/:userId/badges`
  liefern beide `{earned}` für dieselbe Komponente (`KonfiBadgesSection.tsx:71-74`).
  17 Stellen sichern zusätzlich mit `Array.isArray`. Methode: Regex-Extraktion
  + `res.json`-Zeilen je Route, siehe Abschnitt Methode.
- **`GET /admin/activities/requests` und `/admin/konfis` bleiben Arrays**, auch
  ohne Jahrgangszuweisung (Header `X-Kein-Jahrgang-Zugewiesen`) — Kommentar
  nennt ausdrücklich den Vertrag mit den Store-Apps (activities.js:353-357).
- **Rollenvergabe (Schwerpunkt 6):** `UserManagementModal.canAssignRole`
  (Zeilen 138-155) spiegelt `roleHierarchy.canManageRole` exakt: org_admin →
  org_admin/admin/teamer, admin → teamer; konfi nur über KonfiModal; super_admin
  nie. `GET /roles` filtert für `admin` serverseitig (roles.js:64-67);
  `POST /users` läuft durch `checkUserHierarchy('create')` (users.js:184).
  `EinladungModal` blendet konfi/super_admin aus (Zeile 53), Backend weist
  konfi zusätzlich ab (einladungen.js:78-83).
- **Sichtbarkeit Verwaltungsseiten:** Benutzer:innen nur org_admin/super_admin
  (AdminSettingsPage.tsx:284), Organisationen und Betrieb nur `is_super_admin`
  (:206-211); Backend `requireSuperAdmin` bzw. Inline-Prüfung
  (organizations.js:78, createApp.js:451-453). Fremde Adresse liefert 403 mit
  Meldung „Nur für Super-Admins." (AdminMetricsPage.tsx:308).
- **Konfi anlegen:** Benutzername global eindeutig mit Zähler
  (`generateUniqueUsername`), Bibelstellen-Passwort, Anzeige als Alert mit
  „Kopieren" (AdminKonfisPage.tsx:261-279) — deckt sich mit Handbuch 35;
  Limit-Stufen (409 grace mit Rückfrage, 403 hard) sauber behandelt (:283-341).
- **Jahrgangswechsel:** Warnungen im KonfiModal (Punkteart abgeschaltet,
  eigene Sicht geht verloren) stimmen mit dem Backend überein: alte künftige
  Buchungen ohne Anwesenheit fallen weg (konfi-management.js:437-456),
  Warteliste rückt nach (:473-482), Pflichttermine des neuen Jahrgangs werden
  gebucht (:484-496), Chats werden synchronisiert (:421-426), alles in einer
  Transaktion.
- **Beförderung:** Rückfrage nennt Punkte/Badges und dass Buchungen und
  offene Anträge gelöscht werden — entspricht `promote-teamer`
  (konfi-management.js:1502 ff.); Jahrgangsbindung serverseitig (`darfKonfi`).
- **Konfi löschen:** Rückfrage mit `role: 'destructive'`; Kaskade in
  `konfiDeletion.js` löscht 16 Tabellen in FK-Reihenfolge, rückt Warteliste
  nach, entfernt Dateien nach dem Commit (Text unvollständig, BF-10).
- **Termin absagen/löschen:** Absage mit optionalem Grund, zweiter Modus für
  nachträglichen Grund über eigene Route (kein Vertragsbruch an `/cancel`);
  Löschen mit zweiter Rückfrage bei Buchungen (`eventLoeschenRueckfrage.test.tsx`
  bildet die Ionic-Overlay-Mechanik nach).
- **Anwesenheit:** Optimistisches Update mit Rückabwicklung bei Fehler
  (EventDetailView.tsx:802-830); „Alle bestätigen" getrennt nach Konfi/Team mit
  Punkte-Hinweis (:955-1000); Warteliste bestätigen/entfernen über
  `/participants/:id/status`.
- **QR-Code:** `POST /events/:id/generate-qr` idempotent (bestehendes Token
  wird zurückgegeben), `requireTeamer`, Token mit Org-ID signiert
  (checkin.js:276-302); Live-Zähler zählt nur `confirmed`.
- **Anträge:** Ablehnung erzwingt Grund (ActivityRequestModal.tsx:156-159),
  Doppelklick über `useActionGuard` (:161), Foto serverseitig entschlüsselt
  und als Blob mit `DATEI_TIMEOUT_MS` geladen, Blob-URL wird freigegeben
  (:130-136). Massenfreigabe gibt es nicht — das Handbuch verspricht keine.
- **Challenges:** Moderation mit `busyId` je Beitrag, Anonymisieren mit
  Rückfrage („nicht rückgängig"), Löschen mit Rückfrage; Medien per
  `/challenges/files/:name` als Blob (ChallengeLeitungModal.tsx:95-130).
- **Kriterien-Editor:** Liste kommt vom Backend (`/admin/badges/criteria-types`,
  16 Typen); UI blendet für Teamer:innen Punkte-, Zeit-, Serien-, Event- und
  Pflicht-Typen aus und `teamer_year` für Konfis — deckt sich mit den
  ausgewerteten Fällen beider Zweige (badges.js:264-399, 486-660) und mit der
  Tabelle in 60-badges.md:314-330 (Ausnahme BF-09).
- **Einstellungen:** `GET/PUT /settings` je Gemeinde (`organization_id`),
  PUT nur org_admin, optimistisches Umschalten mit Rückabwicklung, Offline in
  die Schreibwarteschlange; Reihenfolge-Merge für neue Sektionen
  (AdminDashboardSettingsPage.tsx:152-238).
- **Multi-Gemeinde (Schwerpunkt 10):** Alle Cache-Schlüssel der Admin-Seiten
  tragen `organization_id` (einzige Ausnahme `super-admin-organizations`,
  gemeindeübergreifend korrekt); `switchOrg` leert den Cache, wechselt Token
  und Rolle, feuert `org:switched`, erhöht `orgVersion` → Router-Remount
  (App.tsx:240), navigiert mit `direction 'root'`. RBAC-Cache schließt die
  aktive Org in den Schlüssel ein (rbac.js:19). Umschalter-Regel per Test
  `appKopfzeile.test.tsx` erzwungen.
- **Kennzahlen (Schwerpunkt 8):** Nur super_admin; Ampel-Schwellen
  dokumentiert (`betriebsKennzahlen.ts`: Apdex 0,94/0,85/0,70/0,50,
  Störung bei Fehlern in den letzten 10 Punkten, „zäh" unter 0,85, Warten bei
  >5 % über 1 s); Nutzer-IDs werden gehasht (apm.js:140-143), 404 zählt nicht
  als Fehler. Personenbezug nur über Roh-URLs (BF-12).
- **Handbuch 45 (Jahrgang löschen):** Zwei Sperren (aktive Konfis → 409;
  Chat-Nachrichten → 409 mit `canForceDelete`, „Dennoch löschen" nur
  org_admin) — Text und Code deckungsgleich (AdminJahrgaengeePage.tsx:527-585,
  jahrgaenge.js:329-400).
- **Typprüfung:** `npx tsc --noEmit` Exit 0 (20,5 s).

## Nicht geprüft

- Rendering auf echten Geräten (kein Simulator, keine Produktion).
- `AdminWrappedPage`, `AdminCertificatesPage`, `AdminMaterialPage`,
  `AdminLevelsPage`, `AdminCategoriesPage` nur auf Routen-/Formabgleich, nicht
  fachlich gegen Handbuch 40/95.
- `AttendanceMatrixModal` (Matrix-E-Mail) fachlich.
- `AdminProfilePage`, `ChangePasswordModal`, `ChangeEmailModal`,
  `DeleteAccountModal` (Konto-Selbstverwaltung; eher Bereich Auth).
- Offline-Schreibwarteschlange in den Admin-Formularen (eigener Bereich).
- Barrierefreiheit, Dunkelmodus, iPad-Split-View.

## Auf Produktion nachzumessen

1. **BF-01 Betroffene:** Personen, die in einer Gemeinde arbeiten, deren
   Stamm-Gemeinde eine andere ist, mit Rolle admin/teamer dort:
   ```sql
   SELECT uo.organization_id, r.name, COUNT(*)
   FROM user_organizations uo JOIN users u ON u.id = uo.user_id
   JOIN roles r ON r.id = uo.role_id
   WHERE u.organization_id <> uo.organization_id AND r.name IN ('admin','teamer')
   GROUP BY 1,2;
   ```
   Für jede davon: Anzahl Jahrgangszuweisungen in der Zweitgemeinde
   (`user_jahrgang_assignments` ⋈ `jahrgaenge.organization_id`).
2. **BF-04 Antragsliste:** Zeilen und Antwortgröße je Gemeinde:
   ```sql
   SELECT a.organization_id, COUNT(*), pg_size_pretty(SUM(pg_column_size(ar.*))::bigint)
   FROM activity_requests ar JOIN activities a ON a.id = ar.activity_id GROUP BY 1 ORDER BY 2 DESC;
   ```
   Dazu die gemessene Dauer von `GET /admin/activities/requests` aus dem
   APM (Route `GET /api/admin/activities/requests`, p50/p95).
3. **BF-09:** `SELECT id, name, organization_id FROM custom_badges WHERE target_role='teamer' AND criteria_type='mandatory_event_count';`
4. **BF-14:** Renderzeit der Konfi-Liste der größten Gemeinde auf einem
   Mittelklasse-Android (Safari/Chrome Performance-Panel), Suche mit fünf
   Tastendrücken.
5. **BF-06/BF-12:** Anteil der 404 auf `GET /api/admin/jahrgaenge/:id` im
   Fehlerprotokoll des Betriebs-Dashboards (Reiter „Fehler"), und ob dort
   URLs mit `?q=` oder `check-username/` stehen.
6. **BF-03:** `SELECT id, name, event_date, event_end_time FROM events WHERE event_end_time < event_date;`
   — gibt es solche Termine bereits?
