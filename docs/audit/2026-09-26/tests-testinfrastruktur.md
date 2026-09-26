# Audit Tests und Testinfrastruktur — 26.09.2026

## Umfang und Methode

**Geprüft** (gelesen, ausgeführt, gemessen):

- Backend-Testinfrastruktur: `backend/tests/vitest.config.ts`, `globalSetup.js`, `globalTeardown.js`, `setupTests.js`, `helpers/{auth,db,seed,testApp}.js`, `schema/{prod-schema.sql,prod-migrations.txt,refresh-schema.sh}` und die drei Schema-Wächter `schema/*.test.js`. Alle 139 versionierten Backend-Testdateien (85 routes, 21 services, 30 utils, 3 schema) statisch ausgewertet; 13 Dateien einzeln ausgeführt.
- Frontend-Testinfrastruktur: `frontend/vite.config.ts` (Vitest-Block), `src/setupTests.ts`, `src/__mocks__/`, alle 263 versionierten Dateien unter `src/__tests__/` plus `src/App.test.tsx`.
- E2E: `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/global-teardown.ts`, `e2e/helpers/auth.ts`, alle acht Specs, `docker-compose.e2e.yml`, `backend/docker-compose.test.yml`.
- CI: `.github/workflows/ci.yml` (Jobs `backend-test`, `frontend-test`, `e2e-test`).
- Neuinstallation: `init-scripts/{README.md,01-create-schema.sql,02-migrationsstand.sql,refresh.sh}`.
- Produktivcode nur dort, wo ein Test ihn schützen soll (Gegenprobe) oder der Testlauf davon abhängt (`database.js`, `createApp.js`, `server.js`, `routes/events/checkin.js`).

**Wie:**

- Alle Backend-Läufe auf **Port 5438** (eigene Postgres-16-Instanz), nur einzelne Dateien, nie die Gesamtsuite. Für Schema-Vergleiche zwei eigene Datenbanken: `audit_konfi` (Aufbau exakt wie `globalSetup.js`) und `audit_e2e` (Aufbau wie `docker-compose.e2e.yml` + `database.js` — nur Dump, leeres `schema_migrations`, danach alle Migrationen „nicht-blockierend“). Skript: `scratchpad/tests-testinfrastruktur/schema_experiment.js`.
- Zählungen ausschließlich über `git ls-files`. Im Arbeitsbaum lagen während des Audits **unversionierte Testdateien anderer Prüfer** (`backend/tests/audit-tmp/`, `backend/tests/routes/zz_audit_*.test.js`, `zzz_audit_fachlogik_tmp.test.js`, `frontend/src/__tests__/audit-tmp/`, `auditTmp*.test.tsx`, `tmpAuditGrosseListen.test.tsx`). Sie sind aus allen Zahlen herausgerechnet.
- Routen-Abgleich: jedes `router.<methode>('<pfad>')` in `backend/routes/**` mit dem Mount aus `createApp.js` zu einem vollen Pfad zusammengesetzt (`routes/events/*` unter `/api/events`, `users.js` doppelt unter `/api/admin/users` und `/api/users`) und gegen `.<methode>(\`<pfad>\`)`-Aufrufe in allen Testdateien gesucht; `:param` als beliebiges Segment. Drei Fehlalarme des Werkzeugs (Pfad in einer Konstanten bzw. Liste: `badge-counts/je-organisation`, beide `bible-translation`) von Hand geprüft und herausgenommen; `GET /api/teamer/requests` und `GET /api/teamer/:userId/badges` per Rohstring-Suche als echte Lücken bestätigt.
- Gegenprobe „grüner Test beweist nichts“: Fehler per `perl`-Ersetzung in den Produktivcode eingebaut, der schützende Test mit `-t <Name>` (oder die ganze Datei) laufen lassen, Datei aus Sicherung zurückgespielt, `git diff --quiet` je Datei geprüft. Skript und Ausgaben: `scratchpad/tests-testinfrastruktur/gegenprobe/`.
- Laufzeiten: die acht größten Route-Testdateien einzeln mit `--reporter=json`, Dauer je Test ausgewertet.
- Lint: `npx eslint src -f json` im Frontend (45 s), ausgezählt nach Regel und Schwere.

**Bewusst nicht geprüft und warum:**

- Gesamtsuiten (Backend ≈10 min, Frontend 132 s) — laufen bei der Koordination; Baseline von dort: Frontend 264 Dateien / 3788 Tests grün, `tsc --noEmit` grün.
- `npx playwright test`: nicht möglich. `docker pull postgres:16-alpine` scheitert am Proxy mit `429 Too Many Requests`; `docker images` ist leer; kein Playwright-Browser-Cache. Die Specs sind nur gelesen; der E2E-Schema-Aufbau wurde außerhalb von Docker nachgestellt (BF-01).
- Ob die geschützten Routen ohne Fremd-Gemeinde-Test tatsächlich einen Gemeinde-Filter haben, ist Sache des Sicherheitsbereichs. Hier steht nur, dass **kein Test** es beweist — und für die Termin-Detailansicht ist per Gegenprobe belegt, dass kein Test es bemerken würde (BF-03).

## Zusammenfassung

Die Backend-Suite ist handwerklich solide: echte Datenbank aus dem Produktions-Dump, feste Seed-IDs, vollständige TRUNCATE-Liste (58/58 Tabellen), keine übersprungenen Tests, kein Testblock ohne Erwartung, alle acht großen und fünf kleinen Dateien allein grün, kein Test näher als 3,2 s am 10-s-Limit. Von 15 Gegenproben fielen 11 wie gewünscht — eine ausgebaute Rechteprüfung, ein gebrochener Antwortvertrag (`/teamer/badges`), eine abgeschaltete Kapazitätsgrenze, ein ausgebauter Soft-Revoke werden erkannt. Zwei Gegenproben fielen **nicht**, und das ist der schwerste Befund: Der Gemeinde-Filter der Termin-Detailansicht (`GET /api/events/:id`, liefert u. a. `qr_token`) lässt sich entfernen, ohne dass einer der 223 Tests in den vier aufrufenden Dateien fällt — es gibt schlicht keinen Test „fremde Gemeinde → 404“ dafür; und die weiche Erwartung `[401, 403]` in `organizations.test.js` bleibt grün, egal ob der Soft-Revoke greift. Die Frontend-Suite ist zu 46 % eine Quelltext-Prüfung: 123 der 263 Dateien (1164 von 2521 `it`-Blöcken) lesen Komponenten-Quelltext per `readFileSync` und prüfen Zeichenketten statt Verhalten; nur 78 Dateien rendern überhaupt etwas. Der E2E-Stack baut seine Datenbank mit leerem Migrationsstand: 51 Migrationen laufen bei jedem Start doppelt, zwei scheitern jedes Mal und werden „übersprungen“. Das Lint-Gate der CI läuft nur bei Pull Requests, aber 514 von 541 Commits seit dem 1.9. gingen direkt auf `main`; heute stehen 19 Fehler im Frontend, wo der CI-Kommentar „null“ behauptet. 15 Backend-Routen haben keinen einzigen Test, mindestens 23 geschützte Routen keinen Test „fremde Gemeinde → 403/404“.

Befunde: 0 KRITISCH, 0 HOCH, 10 MITTEL, 6 NIEDRIG.

Die drei wichtigsten Punkte: (1) Termin-Detailansicht ohne Fremd-Gemeinde-Test, per Gegenprobe belegt (BF-01); (2) Frontend-Tests prüfen überwiegend Quelltext statt Verhalten (BF-02); (3) E2E-Datenbank ohne Migrationsstand (BF-03).

## Release-Empfehlung für den Bereich

**mit Auflage** — Die Testinfrastruktur selbst blockiert das Release nicht; die Gegenproben zeigen, dass die vorhandenen Backend-Tests echte Fehler fangen. Auflage: Für `GET /api/events/:id` (BF-01) und die 23 geschützten Routen ohne Fremd-Gemeinde-Test (BF-05, insbesondere `POST /api/events/qr-checkin`, `POST /api/events/:id/generate-qr`, `GET /api/events/:id/attendance-count`, `POST /api/konfi/upload-photo`, `POST /api/konfi/events/:id/opt-in`) muss vor dem Release entweder ein Test „fremde Gemeinde → 403/404“ vorliegen oder der Sicherheitsbereich den Gemeinde-Filter am Code bestätigen. Alles andere kann nach dem Release folgen.

## Befunde

### BF-01: Termin-Detailansicht ohne Fremd-Gemeinde-Test — Gemeinde-Filter entfernbar, 223 Tests bleiben grün
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/events/lesen.js:618` (Filter), `backend/tests/routes/events.test.js`, `orgWechselEigeneBuchung.test.js`, `rbac.test.js`, `teamerSiehtTeilnehmerliste.test.js` (die vier Dateien, die `GET /api/events/:id` aufrufen)
- **Kennzeichnung:** reproduziert — Gegenprobe G12/G12b/G12c/G12d: `WHERE e.id = $1 AND e.organization_id = $2` → `WHERE e.id = $1 AND ($2::int IS NOT NULL)`, dann `npx vitest run --config tests/vitest.config.ts tests/routes/events.test.js` (164 passed), `orgWechselEigeneBuchung.test.js` (6 passed), `rbac.test.js` (48 passed), `teamerSiehtTeilnehmerliste.test.js` (5 passed). Statisch bestätigt: keine versionierte Testdatei ruft `.get(\`/api/events/${…}\`)` mit einem Token aus `andereGemeinde` auf.
- **Beschreibung:** Die Detailansicht eines Termins (Name, Ort, Beschreibung, `qr_token`, `created_by`, Zeitfenster, Serie) wird über `organization_id` gefiltert. Kein Test prüft, dass eine fremde Gemeinde 404 bekommt. Das Werkzeug aus Schwerpunkt 3 hatte die Route als „abgedeckt“ gezählt, weil `events.test.js` an anderer Stelle Fremd-Org-Token nutzt — die Gegenprobe zeigt, dass diese Datei-Heuristik zu optimistisch ist.
- **Auswirkung aus Nutzersicht:** Heute keine — der Filter steht im Code. Aber die Regel „Änderungen an Rechteprüfungen bekommen Tests“ ist hier nicht eingelöst: Ein späteres Refactoring der 100-Zeilen-Abfrage könnte den Filter verlieren, und die Suite bliebe grün. Dann sähe eine Konfi aus Gemeinde A Termindetails samt QR-Token aus Gemeinde B.
- **Beleg:** `[G12] routes/events/lesen.js :: tests/routes/events.test.js → vitest rc=0 (67 s) | Tests 164 passed (164)`; gleiches Bild für G12b–d.
- **Empfehlung:** In `events.test.js` einen Test „`GET /api/events/:id` mit `konfi3`/`admin2` auf `EVENTS.gottesdienstEvent.id` → 404“ ergänzen (verbotener Fall) neben dem bestehenden erlaubten Fall. Dasselbe Muster für `/:id/timeslots` ist vorhanden (`events.test.js:971`) und kann kopiert werden.

### BF-02: 46 % der Frontend-Tests prüfen Quelltext statt Verhalten
- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/__tests__/**` — 123 von 263 Dateien lesen per `readFileSync` Komponenten-Quelltext und rendern nichts; z. B. `components/teamerTerminAbsagen.test.ts:116`, `components/adminZusageAusBookingStatus.test.ts:89`, `components/abgesagteTermineAnsichten.test.ts:233`, `components/terminRechteOberflaeche.test.ts:102`, `components/teamerZusageKarteAbgesagt.test.ts:99`
- **Kennzeichnung:** reproduziert (gezählt): `xargs -a fe_tracked.txt grep -l readFileSync | xargs grep -L 'render('` → 123 Dateien / 1164 `it`-Blöcke; `render(`/`renderHook(` → 78 Dateien / 715 `it`-Blöcke; 1486 Erwartungen der Form `expect(quelle).toContain('…')`/`toMatch`.
- **Beschreibung:** Fast die Hälfte der Frontend-Tests prüft, ob eine Zeichenkette im Quelltext steht (`expect(code).toContain('if (!zusageKarteInhalt) return null;')`, `expect(detail.match(/\|\| !darfVerwalten\) return null;/g).length).toBe(2)`). Solche Tests fallen bei jeder Umformulierung und bleiben grün, wenn die Zeile zwar steht, aber nicht das tut, was der Titel verspricht. Sie ersetzen keinen gerenderten Test: Ob „Absagen nur mit Recht“ gilt, prüft man, indem man die Komponente ohne Recht rendert und den Knopf nicht findet.
- **Auswirkung aus Nutzersicht:** Die Zahl „3788 grüne Frontend-Tests“ sagt weniger über die App aus, als sie klingt. Gerade die Rechte-Oberfläche für Teamer:innen (BF Nr. 13 in `docs/offene-befunde.md`, 16.09.) ist überwiegend so getestet.
- **Beleg:** Auszählung oben; Stichprobe: `terminRechteOberflaeche.test.ts` (Rechte im Termin-Detail) enthält kein `render(`.
- **Empfehlung:** Neue Frontend-Tests rendern. Bestehende Quelltext-Tests dort durch gerenderte ersetzen, wo sie Rechte oder Nutzerabläufe absichern (Termin-Detail, Absage, Zusage-Karte); reine Stil-Wächter (Tokens, Farben, Abstände) dürfen Quelltext lesen — das ist ihr Zweck.

### BF-03: E2E-Datenbank startet mit leerem Migrationsstand — 51 Migrationen laufen doppelt, 2 scheitern bei jedem Start
- **Schwere:** MITTEL
- **Fundstelle:** `docker-compose.e2e.yml:20-22` (nur `prod-schema.sql` eingehängt, `init-scripts/02-migrationsstand.sql` fehlt), `backend/database.js:142-151` (Fehler wird geloggt, Server startet)
- **Kennzeichnung:** reproduziert — `NODE_PATH=backend/node_modules node scratchpad/tests-testinfrastruktur/schema_experiment.js` baut `audit_e2e` genau so auf: `schema_migrations nach Dump: 0 Zeilen`; `erneut angewandt (erfolgreich): 87, fehlgeschlagen (übersprungen): 2`; davon 51 mit Nummer < 124, also bereits im Dump enthalten. Fehlgeschlagen: `064_add_missing_fks.sql :: column "konfi_id" does not exist`, `064_add_missing_indexes.sql :: column "konfi_id" does not exist`.
- **Beschreibung:** Der Dump ist schema-only, die Tabelle `schema_migrations` kommt leer. Beim Start läuft `runMigrations` über alle 89 Dateien; 87 gelingen (weil sie `IF NOT EXISTS`/idempotent sind), zwei scheitern und werden mit „Server laeuft weiter“ übersprungen. Das Endschema ist mit dem Test-Schema identisch (Tabellen 59/59, Spalten 539/539, Indizes 215/215, Views 1/1; eine CHECK-Constraint auf `challenges.audience` textlich anders, semantisch gleich) — aber nur, weil die Migrationen zufällig doppelt laufen dürfen. Für die Backend-Tests hat `globalSetup.js` genau dafür `prod-migrations.txt`; für Neuinstallationen gibt es `02-migrationsstand.sql`. Der E2E-Stack nutzt beides nicht.
- **Auswirkung aus Nutzersicht:** Keine direkte. Für die Leitung/Entwicklung: Jeder E2E-Lauf loggt zwei rote „Migration FAILED“, was echte Migrationsfehler im Log verdeckt. Eine künftige, nicht idempotente Migration lässt den E2E-Stack aus einem Grund fallen, der mit der App nichts zu tun hat — und blockiert den Deploy.
- **Beleg:** Ausgabe in `scratchpad/tests-testinfrastruktur/schema_experiment.log`.
- **Empfehlung:** In `docker-compose.e2e.yml` zusätzlich `./init-scripts/02-migrationsstand.sql:/docker-entrypoint-initdb.d/02-migrationsstand.sql:ro` einhängen — oder gleich beide `init-scripts`-Dateien, dann geht der E2E-Stack denselben Weg wie eine Neuinstallation.

### BF-04: 15 Backend-Routen ohne einen einzigen Test
- **Schwere:** MITTEL
- **Fundstelle:** siehe Liste
- **Kennzeichnung:** reproduziert (statisch): `node scratchpad/tests-testinfrastruktur/routen_abgleich.js` (nur versionierte Tests), Fehlalarme von Hand geprüft
- **Beschreibung:** 251 eindeutige Routen (260 mit Doppel-Mount von `users.js`), 15 davon werden von keiner Testdatei mit passender Methode aufgerufen:

  | Route | Datei:Zeile | Anmerkung |
  |---|---|---|
  | `POST /api/auth/update-email` | `auth.js:455` | ändert Kontaktdaten |
  | `POST /api/auth/update-role-title` | `auth.js:483` | |
  | `GET /api/auth/invite-codes` | `auth.js:779` | Einladungscode-Verwaltung |
  | `POST /api/auth/invite-codes/:id/extend` | `auth.js:808` | Einladungscode-Verwaltung |
  | `DELETE /api/auth/invite-codes/:id` | `auth.js:847` | Einladungscode-Verwaltung |
  | `GET /api/auth/check-username/:username` | `auth.js:866` | öffentlich; nur als Zeichenkette in `apmPfadNormalisierung.test.js` |
  | `GET /api/auth/validate-invite/:code` | `auth.js:895` | öffentlich; ebenso |
  | `GET /api/challenges/admin/authors` | `challenges.js:1177` | |
  | `DELETE /api/chat/rooms/:roomId/leave` | `chat.js:1683` | Raum verlassen |
  | `GET /api/events/user/bookings` | `events/buchung.js:278` | eigene Buchungen |
  | `PUT /api/admin/konfis/:id/teamer-since` | `konfi-management.js:1481` | |
  | `GET /api/konfi/events/:id/participants` | `konfi.js:1452` | anonymisierte Teilnehmerliste („Vorname N.“) — Datenschutzrelevant, ungetestet |
  | `GET /api/teamer/:userId/badges` | `teamer.js:404` | Abzeichen einer anderen Person |
  | `GET /api/teamer/activities` | `teamer.js:1088` | |
  | `GET /api/teamer/requests` | `teamer.js:1109` | nur `POST`/`DELETE` getestet |

  Die drei Einträge von `users.js` unter `/api/users` (`POST /`, `DELETE /:id`, `POST /:id/jahrgaenge`) sind unter `/api/admin/users` getestet und hier nicht gezählt.
- **Auswirkung aus Nutzersicht:** Für die anonymisierte Teilnehmerliste prüft niemand, dass die Anonymisierung („Vorname N.“) hält oder dass nur die eigene Gemeinde sichtbar ist. Die Einladungscode-Verwaltung der Leitung ist komplett ungetestet.
- **Beleg:** `scratchpad/tests-testinfrastruktur/routen_abgleich.log`
- **Empfehlung:** Zuerst `GET /api/konfi/events/:id/participants` (Anonymisierung + Fremd-Gemeinde) und die drei `invite-codes`-Routen testen.

### BF-05: Mindestens 23 geschützte Routen ohne Test „fremde Gemeinde → 403/404“
- **Schwere:** MITTEL
- **Fundstelle:** siehe Liste
- **Kennzeichnung:** reproduziert (statisch): `node scratchpad/tests-testinfrastruktur/multiorg_routen.js` — je geschützter Route geprüft, ob eine aufrufende Testdatei ein Token aus `andereGemeinde` **und** ein 403/404 enthält. Das ist eine Untergrenze: BF-01 zeigt, dass Routen als „abgedeckt“ zählen, obwohl der konkrete Test fehlt.
- **Beschreibung:** Von 217 geschützten Routen haben 191 eine solche Datei in Reichweite, 26 nicht — abzüglich der drei Werkzeug-Fehlalarme bleiben 23. Darunter neben den ungetesteten aus BF-04:

  | Route | Datei:Zeile | getestet, aber ohne Fremd-Org-Token |
  |---|---|---|
  | `POST /api/events/qr-checkin` | `events/checkin.js:39` | 3 Dateien |
  | `POST /api/events/:id/generate-qr` | `events/checkin.js:276` | 4 Dateien |
  | `GET /api/events/:id/attendance-count` | `events/checkin.js:310` | 1 Datei |
  | `POST /api/konfi/upload-photo` | `konfi.js:787` | 2 Dateien |
  | `POST /api/konfi/events/:id/opt-in` | `konfi.js:1956` | 1 Datei |
  | `GET /api/roles`, `GET /api/roles/:id`, `GET /api/roles/list/assignable` | `roles.js:34/77/117` | 1 Datei |
  | `GET /api/admin/users/me/jahrgaenge` | `users.js:851` | 1 Datei |

  Für die 2.3.0-Neuerung selbst (Mehrfach-Mitgliedschaft, `X-Active-Organization`) gibt es dagegen gezielte Tests: `konfiInZweitgemeinde`, `orgWechselEigeneBuchung`, `orgWechselRollenGrenze`, `profilInZweitgemeinde`, `teamKontakteMultiOrg`, `jahrgangsZuweisungZweitgemeinde`, `wrappedTeamerZweitgemeinde`, `pushBadgeMultiOrg`, `pushEmpfaengerMultiOrg`, `badgeJeOrganisation`, `einladungen` (17 Tests, darunter „FREMDE Einladung lässt sich nicht annehmen“ und „Rolle aus FREMDER Gemeinde“); `X-Active-Organization` kommt in 11 versionierten Testdateien vor.
- **Auswirkung aus Nutzersicht:** Beim QR-Check-in und beim Foto-Upload ist nicht nachgewiesen, dass eine Person aus Gemeinde A nicht an einem Termin von Gemeinde B eingecheckt wird bzw. dass die Antwort keine fremden Daten enthält.
- **Beleg:** `scratchpad/tests-testinfrastruktur/multiorg_routen.log`
- **Empfehlung:** Für jede geschützte Route mit `:id` ein Testpaar „eigene Gemeinde → erlaubt / fremde Gemeinde → 404“; Vorlage: `rbac.test.js` „Cross-Org-Isolation“.

### BF-06: Weiche Assertions — 7 Statuslisten, eine davon lässt 500 durch; `toBeLessThan(500)`; Zähler `>= 0`; bedingte Erwartungen
- **Schwere:** MITTEL
- **Fundstelle:** siehe Liste
- **Kennzeichnung:** reproduziert (gezählt; für Nr. 4 per Gegenprobe G08b belegt)
- **Beschreibung:** CLAUDE.md verbietet weiche Assertions. Zählung über versionierte Dateien:

  | Muster | Backend | Frontend |
  |---|---|---|
  | `expect([...]).toContain(status)` | 7 (von 10 `toContain`-Listen) | 0 |
  | `toBeDefined()` | 200, davon 105 auf `res.body.*` | 11 |
  | `toBeGreaterThanOrEqual(0)` | 7 | 0 |
  | `toBeTruthy()` | 33 | 132 |
  | `not.toBe(500)` / `toBeLessThan(500)` | 0 / 1 | 0 |
  | `it.skip` / `it.todo` / `.only` | 0 | 0 |
  | bedingte Erwartung (`if (…) { expect }`) | 2 | 1 |
  | `it` ohne Erwartung | 0 | 0 |
  | leere `catch {}` um Erwartungen | 0 (14 `catch` gesamt, alle Aufräumen/Setup) | 0 |

  Die zehn schlimmsten Stellen und was sie durchlassen:
  1. `backend/tests/routes/rbac.test.js:474` — `expect([404, 400, 500]).toContain(res.status)`: Ein Absturz (500) beim `PUT` einer fremden Aktivität gilt als bestanden. Der Code liefert per `rowCount === 0` ein 404 (`activities.js:197`).
  2. `backend/tests/routes/material.test.js:464` — `expect(res.status).toBeLessThan(500)` unter dem Titel „Ohne Datei ergibt 400“: Ein 200 (Material ohne Datei angenommen) besteht.
  3. `backend/tests/services/autoDeletion.test.js:255` — `expect(res.sent).toBeGreaterThanOrEqual(0)`: für einen Zähler immer wahr; null verschickte Erinnerungen bestehen (der Kommentar räumt es ein).
  4. `backend/tests/routes/organizations.test.js:1224` — `expect([401, 403]).toContain(nachher.status)` unter „nach dem Entzug endet der Zugriff sofort“: Gegenprobe G08b — mit ausgebautem Soft-Revoke in `rbac.js` bleibt der Test grün (403 aus der Mitgliedschaftsprüfung). Er kann nicht sagen, welcher Mechanismus greift.
  5. `backend/tests/routes/chat.test.js:959` — `expect([200, 400, 415]).toContain(res.status)`: Eine Datei mit falschen Magic-Bytes darf angenommen (200) oder abgelehnt werden — der Test prüft die Magic-Byte-Prüfung nicht.
  6. `backend/tests/routes/badges.test.js:612` und `:631` — `if (res.body.level) { expect(...) }`: Fehlt `level` in der Antwort ganz, prüft der Test nichts.
  7. `frontend/src/__tests__/components/tageUndKalendertag.test.ts:86` — `if (gleich.getDate() === new Date().getDate()) { expect(...) }`: zwischen 23:00 und 24:00 Uhr prüft der Test nichts (echtes `new Date()`, keine Fake-Timer).
  8. `frontend/src/App.test.tsx:7` — `expect(baseElement).toBeDefined()`: `baseElement` ist immer definiert; der Test lebt nur davon, dass `render` bei einem Absturz wirft.
  9. `backend/tests/routes/teamer.test.js:1141-1146` — fünf `res.body.<feld>).toBeDefined()` für das Teamer-Dashboard: `null` und `{}` bestehen. Die 105 `res.body.*.toBeDefined()` prüfen Existenz, nicht Form — Vertragstests wie `badgesV2.test.js` machen es richtig (`Array.isArray`, konkrete Längen).
  10. `backend/tests/routes/auth.test.js:81`, `:776`, `badges.test.js:333`, `challenges.test.js:2259` — `[400, 422]`, `[400, 404]`, `[403, 404]`: Der Code liefert genau einen dieser Werte; der Test sollte ihn nennen.
- **Auswirkung aus Nutzersicht:** Indirekt — diese Tests würden bestimmte Fehler (Absturz statt 404, Datei-Upload ohne Prüfung, keine Erinnerung verschickt) nicht melden.
- **Beleg:** Listen in `scratchpad/tests-testinfrastruktur/be_*.txt`; Gegenprobe `gegenprobe/G08b.out`.
- **Empfehlung:** Die zehn Stellen auf den konkreten Wert schärfen; Nr. 4 in zwei Tests teilen (Mitgliedschaft weg → 403; Token alt → 401 mit `generateTokenMitAlter`).

### BF-07: Lint-Gate läuft praktisch nie — nur bei Pull Requests, 514 von 541 Commits gingen direkt auf `main`; heute 19 Fehler
- **Schwere:** MITTEL
- **Fundstelle:** `.github/workflows/ci.yml:139` (`if: github.event_name == 'pull_request'`), Kommentar `:123-138`
- **Kennzeichnung:** reproduziert — `git log --since=2026-09-01 --oneline main | wc -l` → 541; `--merges` → 27. `cd frontend && npx eslint src -f json` (45 s): 579 Dateien, **19 Fehler**, 317 Warnungen.
- **Beschreibung:** Der Lint-Schritt ist auf `pull_request` beschränkt; der Push-Trigger (mit `paths`-Filter) löst ihn nicht aus. Seit dem 1.9. gab es 27 Merge-Commits gegenüber 514 direkten Commits — der Schritt lief also fast nie. Der Kommentar in der CI behauptet „Neue Verstoesse gegen no-explicit-any und no-unused-vars sind FEHLER … Beide stehen aktuell auf null“ und „273 Meldungen, Stand 31.08.2026“. Heute: `@typescript-eslint/no-unused-vars` 15, `react-hooks/globals` 3, `@typescript-eslint/no-require-imports` 1 — in 12 Dateien, darunter 7 Quelldateien (`AdminEventsPage.tsx` 2, `EventDetailView.tsx` (admin) 2, `MainTabs.tsx` 2, `EventDetailSections.tsx`, `EventDetailView.tsx` (konfi), `PushAuswahl.tsx`, `TeamerEventsPage.tsx`) und 5 Testdateien (`pushTokenAktivAbruf.test.tsx` 5). Für das Backend existiert gar keine ESLint-Konfiguration.
- **Auswirkung aus Nutzersicht:** Keine direkte. Für die Entwicklung: Der Schutz, der „scharf seit 31.08.“ sein soll, existiert nur auf dem Papier.
- **Beleg:** `scratchpad/tests-testinfrastruktur/eslint.json`, `eslint_time.log`.
- **Empfehlung:** Lint-Schritt auch bei `push` laufen lassen (Diff gegen `github.event.before`), die 19 Fehler beheben, Kommentar-Zahlen aktualisieren.

### BF-08: `--passWithNoTests` in beiden CI-Testjobs — ein kaputtes include-Muster ergäbe eine grüne CI mit null Tests
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Flag in beiden Jobs entfernt; Vitest 4.1.11 bricht ohne gefundene Tests selbst mit Exit 1 ab (für beide Konfigurationen gegen ein nicht existierendes Muster geprüft). Eine zusätzliche Mindestzahl-Prüfung ist nicht eingebaut.
- **Fundstelle:** `.github/workflows/ci.yml:114` (backend), `:207` (frontend)
- **Kennzeichnung:** reproduziert — Backend: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:1/postgres npx vitest run --config tests/vitest.config.ts --passWithNoTests 'tests/gibt-es-nicht-xyz'` → `No test files found, exiting with code 0`, Exit 0 (der globalSetup wird gar nicht erreicht — der tote Port 1 fiel nicht auf); ohne Flag Exit 1. Frontend: `npx vitest run --passWithNoTests 'src/__tests__/gibt-es-nicht-xyz'` → Exit 0; ohne Flag Exit 1.
- **Beschreibung:** Vitest 4 bricht ohne gefundene Tests von selbst mit Exit 1 ab. Das Flag hebt genau diesen Schutz auf. Ein Tippfehler in `include: ['tests/**/*.test.{js,ts}']` oder ein Umzug des Testordners ließe `build-and-push` und `deploy` durchlaufen, ohne dass ein Test lief.
- **Auswirkung aus Nutzersicht:** Keine direkte; das Test-Gate vor dem Deploy hätte ein stilles Loch.
- **Beleg:** Ausgabe oben.
- **Empfehlung:** Flag in beiden Jobs entfernen; zusätzlich die Testanzahl im Job-Log auf einen Mindestwert prüfen (z. B. `--reporter=json` und `numTotalTests > 2000`).

### BF-09: E2E-Suite ist zu 85 % Smoke; der Punkte-Test prüft „irgendeine Ziffer“
- **Schwere:** MITTEL
- **Fundstelle:** `e2e/punkte-vergabe.spec.ts:58` (`toContainText(/[1-9]/)`), `:35` (`waitForTimeout(2_000)`), `e2e/aenderungsanzeige.spec.ts:105` (`waitForTimeout`), `playwright.config.ts:5` (`retries: 1`)
- **Kennzeichnung:** aus Code gelesen (Stack nicht startbar, s. Umfang)
- **Beschreibung:** Die acht Specs ergeben 34 Tests. 29 davon prüfen nur „URL passt und ein `ion-content` ist sichtbar“ (`login` 3, `tab-navigation` 7, `deep-link` 19). Fünf sind Abläufe: Buchung, Punktevergabe, Chat, zweimal Änderungsanzeige. Der Punkte-Test verspricht „Konfi sieht Punkte“ und prüft `expect(content).toContainText(/[1-9]/)` — jede Ziffer irgendwo auf dem Dashboard genügt, etwa im Jahrgangsnamen „2025/2026“. Er würde auch bei 0 vergebenen Punkten bestehen. Zwei feste Wartezeiten (`waitForTimeout(2000)`) und `retries: 1` verdecken Flattern, statt es zu zeigen. Der CI-Kommentar „Suite steht auf 32/32“ (31.08.) ist überholt (34).
- **Auswirkung aus Nutzersicht:** Die E2E-Suite ist seit dem 31.08. Deploy-Gate. Sie würde einen Fehler in der Punkteberechnung oder -anzeige nicht bemerken.
- **Beleg:** Specs gelesen; Zählung `grep -c "test("` plus Schleifen.
- **Empfehlung:** Im Punkte-Test den konkreten Wert prüfen (Seed: 3 Bonuspunkte + 1 Aktivität → „4“ an der Stelle, wo die Gottesdienstpunkte stehen); `waitForTimeout` durch `expect.poll`/Locator-Wartezeiten ersetzen; `retries` auf 0 und flatternde Tests reparieren, wie es der CI-Kommentar selbst fordert.

### BF-10: 49 Frontend-Komponenten ohne Bezug in irgendeinem Test — darunter Termin-Detail, Chat-Übersicht, Chat-Socket und die 2.3.0-Einladungs-Oberfläche
- **Schwere:** MITTEL
- **Fundstelle:** siehe Liste
- **Kennzeichnung:** reproduziert (statisch): `node scratchpad/tests-testinfrastruktur/fe_abgleich.js` — Dateiname (Import-Pfad oder Zeichenkette) kommt in keiner versionierten Testdatei vor.
- **Beschreibung:** Von 226 Komponentendateien haben 49 keinen Bezug, dazu 2 von 17 Services (`migrateStorage.ts`, `systemDialoge.ts`), 6 von 38 Utils (`badgeCriteria.ts`, `dateUtils.ts`, `helpers.ts`, `sectionOrder.ts`, `segmentGlas.ts`, `slidingItems.ts`), 2 von 8 Hooks (`useChallengeDelete.ts`, `useMediaCacheControl.ts`). Nutzerrelevant unter den Komponenten: `konfi/pages/KonfiEventDetailPage.tsx`, `konfi/modals/UnregisterModal.tsx`, `chat/pages/ChatOverviewPage.tsx`, `chat/ChatMessagesList.tsx`, `chat/useChatSocket.ts`, `chat/useChatScroll.ts`, `chat/useUmfragenUndReaktionen.ts`, `chat/LazyImage.tsx`, `shared/AudioPlayer.tsx`, `admin/modals/{ActivityManagementModal,BadgeManagementModal,LevelManagementModal,ChangeRoleTitleModal}.tsx` — und die **2.3.0-Neuerung Gemeinde-Einladungen**: `admin/modals/EinladungModal.tsx` und `shared/EinladungenKarte.tsx` (die Testdatei `einladungVerlaengernRueckmeldung.test.ts` betrifft Einladungs*codes*, nicht Gemeinde-Einladungen). 27 der 49 sind Rückblick-Folien (`wrapped/slides/**`), die von Registry-Tests indirekt erfasst sein können.
- **Auswirkung aus Nutzersicht:** Ob die Leitung eine Einladung in eine zweite Gemeinde aussprechen und die eingeladene Person sie annehmen kann, ist im Backend 17-fach getestet, in der Oberfläche gar nicht.
- **Beleg:** `scratchpad/tests-testinfrastruktur/fe_abgleich.log`
- **Empfehlung:** Gerenderte Tests für `EinladungModal`/`EinladungenKarte` (2.3.0) und `KonfiEventDetailPage`/`UnregisterModal` vor dem Release.

### BF-11: Doku- und Kommentar-Drift in der Testinfrastruktur
- **Schwere:** NIEDRIG
- **Fundstelle:** `README.md:131` („1625 Tests“), `:138` („2470 Tests“), `backend/tests/vitest.config.ts:6` („alle 24 Suites“), `backend/tests/helpers/testApp.js:43` („65 Testdateien“), `backend/tests/helpers/db.js:60` und `.github/workflows/ci.yml:75` („~45 Tabellen“), `ci.yml:76` („truncateAll laeuft 111 Mal“), `ci.yml:124/137` („273 Meldungen“, „auf null“), `ci.yml:214` („32/32“), `docs/offene-befunde.md:429` (Nr. 12 „IN ARBEIT“)
- **Kennzeichnung:** reproduziert (gezählt)
- **Beschreibung:** Frontend heute 264 Dateien / 3788 Tests (Koordination), Backend 139 Dateien / 3296 statische `it` + 17 `it.each`; 58 Tabellen in der TRUNCATE-Liste; `truncateAll` steht 119-mal in 107 Dateien; Lint 336 Meldungen; E2E 34 Tests. Befund Nr. 12 (init-scripts) ist erledigt: `init-scripts/01-create-schema.sql` und `backend/tests/schema/prod-schema.sql` sind bis auf Kommentare identisch (`diff` leer), der Migrationsstand ebenso, der Wächter `neuinstallation.test.js` existiert — die Doku sagt noch „in Arbeit“. `init-scripts/README.md` stimmt dagegen mit dem heutigen Verhalten überein.
- **Auswirkung aus Nutzersicht:** keine.
- **Beleg:** Zählungen oben.
- **Empfehlung:** Zahlen aus Kommentaren nehmen oder datieren; Nr. 12 als behoben markieren.

### BF-12: Node-Versionen uneinheitlich — CI 26, Docker-Images 26, `engines` ≥ 22, lokal 22, E2E-Job 20
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/workflows/ci.yml:91,127` (26), `:225` (`'20'`), `:220` (`actions/checkout@v4` statt v7), `backend/Dockerfile:1` (`node:26-bookworm`), `frontend/Dockerfile:2` (`node:26-alpine`), `backend/package.json:44` (`>=22.0.0`), `README.md:135` („Node 22“)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Getestet wird unter 26 und (E2E-Seed via `seed.js`/bcrypt) unter 20, entwickelt unter 22, dokumentiert ist 22. Drei Laufzeiten für dieselbe Codebasis; der E2E-Job nutzt zudem ältere Action-Versionen als die übrigen Jobs.
- **Auswirkung aus Nutzersicht:** keine direkte.
- **Beleg:** Fundstellen.
- **Empfehlung:** Eine Version festlegen (`.nvmrc`), alle Jobs und Dockerfiles daran ausrichten.

### BF-13: E2E-Compose weicht von Produktion und Backend-Tests ab — Postgres 16 statt 15, keine Zeitzone, fehlende Schlüssel
- **Schwere:** NIEDRIG
- **Fundstelle:** `docker-compose.e2e.yml:3` (`postgres:16-alpine`; Produktion und `docker-compose.test.yml` 15), `:6-9` (kein `TZ`/`PGTZ`, Backend-Tests und Produktion: Europe/Berlin), `:35-40` (kein `QR_SECRET`, kein `ACTIVITY_PHOTO_ENCRYPTION_KEY`)
- **Kennzeichnung:** aus Code gelesen; `QR_SECRET`-Verhalten in `routes/events/checkin.js:12-22` gelesen
- **Beschreibung:** Ohne `QR_SECRET` startet das Backend nur, weil `NODE_ENV=test` den `process.exit(1)` unterdrückt — Check-in-Codes wären unsigniert. Ohne `ACTIVITY_PHOTO_ENCRYPTION_KEY` wirft `utils/photoCrypto.js:28` beim ersten Foto. Keine E2E-Spec berührt diese Pfade, deshalb fällt es nicht auf. Postgres-16-spezifische Syntax wurde in Migrationen/Code nicht gefunden (grep auf `any_value`, `pg_input_is_valid`, `random_normal`, `JSON_ARRAY`, `JSON_TABLE`, `MERGE` leer), der Versionsunterschied ist heute folgenlos.
- **Auswirkung aus Nutzersicht:** keine direkte.
- **Beleg:** Fundstellen.
- **Empfehlung:** `postgres:15-alpine`, `TZ`/`PGTZ`, beide Schlüssel setzen — dann kann eine künftige E2E-Spec Check-in und Foto abdecken.

### BF-14: Schema-Dump ist fünf Wochen alt, 36 Migrationen laufen obendrauf — kein definierter Auffrisch-Rhythmus
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/tests/schema/prod-schema.sql` (Dump vom 22.08.2026, PostgreSQL 15.19; `git log` zeigt letzte Änderung 22.08.), `prod-migrations.txt` (endet bei 123), `backend/migrations/` (bis 159)
- **Kennzeichnung:** reproduziert — `globalSetup` meldet `36 neue Migrationen`; `audit_konfi`: alle 89 Migrationen in `schema_migrations`.
- **Beschreibung:** Das Konzept „Dump + offene Migrationen = Deploy-Weg“ ist richtig und funktioniert. Es setzt aber voraus, dass Produktion seit dem 22.08. **nur** über Migrationen verändert wurde. Genau das war historisch nicht so (`daily_verses`, `activities.category`, `konfi_profiles.password_plain` von Hand angelegt — Kommentar in `globalSetup.js`). Ob es seit dem 22.08. wieder Handänderungen gab, kann das Repo nicht wissen; `refresh-schema.sh` wurde seit dem Umstieg nicht mehr ausgeführt.
- **Auswirkung aus Nutzersicht:** keine direkte; Risiko, dass ein Produktionsfehler im Test unsichtbar bleibt.
- **Beleg:** Fundstellen; `schema_experiment.log`.
- **Empfehlung:** `refresh-schema.sh` + `init-scripts/refresh.sh` vor jedem Release laufen lassen (Checkliste) — siehe „Auf Produktion nachzumessen“.

### BF-15: Frontend-Testlauf ohne feste Zeitzone, Tests mit echtem `new Date()`
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/vite.config.ts:63-84` (kein `TZ`, kein `testTimeout`), `.github/workflows/ci.yml` Job `frontend-test` (kein `TZ` → Runner-UTC), `frontend/src/__tests__/components/tageUndKalendertag.test.ts:83-112` (fünf Tests mit `new Date()` ohne `vi.useFakeTimers`), `chatOutbox.test.ts:182`
- **Kennzeichnung:** aus Code gelesen (gezählt: 6 Dateien nutzen Fake-Timer, 3 nutzen `new Date()` ohne)
- **Beschreibung:** Das Backend hat die Zeitzone nach dem Vorfall vom 02.09. dreifach festgezogen (Node-Prozess `TZ`, DB-Sitzung `-c timezone`, Compose/CI `TZ`/`PGTZ`); die Kommentare „zwischen 00:00 und 02:00“ in `db.js`, `docker-compose.test.yml`, `ci.yml`, `losungService.test.js` beschreiben behobene Fälle, und `zeitzone.test.js` wacht darüber. Das Frontend läuft lokal in der Zeitzone des Rechners, in der CI in UTC; `formatTimeUntil` wird mit echter Uhrzeit geprüft, einmal bedingt (BF-06 Nr. 7).
- **Auswirkung aus Nutzersicht:** keine direkte; ein Test kann je nach Uhrzeit und Ort anders ausfallen.
- **Beleg:** Fundstellen.
- **Empfehlung:** `TZ: 'Europe/Berlin'` in `test.env` des Frontends, `vi.setSystemTime` in `tageUndKalendertag.test.ts`.

### BF-16: Backend ohne Lint
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/` — keine `eslint.config.*`, kein `eslint` in `backend/package.json`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Das Frontend hat ein (nicht wirksames, BF-07) Lint-Gate, das Backend gar keines. Fehler wie `console.warn` mit einem Leerzeichen Einzug (`routes/auth.js:183`) oder ungenutzte Variablen fallen nicht auf.
- **Auswirkung aus Nutzersicht:** keine.
- **Beleg:** Fundstelle.
- **Empfehlung:** Minimale ESLint-Konfiguration (`no-unused-vars`, `no-undef`) fürs Backend.

## Unklar

- **Läuft die E2E-Suite in der CI heute grün?** Nicht prüfbar (kein Image-Pull, kein Browser). Der letzte belegte Stand ist der CI-Kommentar „32/32“ vom 31.08.; seit dem 14.09. sind zwei Tests dazugekommen. Zu klären über den letzten Lauf von `e2e-test` in GitHub Actions — dort müsste auch das Log „ACHTUNG: 2 Migration(en) fehlgeschlagen“ (BF-03) bei jedem Start stehen.
- **Trifft `/[1-9]/` im Punkte-Test tatsächlich den Jahrgangsnamen?** (BF-09) Braucht den laufenden Stack: Dashboard einer Konfi mit 0 Punkten öffnen und prüfen, ob eine Ziffer sichtbar ist.
- **Laufzeiten der Frontend-Tests einzeln** wurden nicht gemessen; Vitest-Standard-Timeout 5 s, kein Hinweis auf Grenzfälle in der Baseline (132 s gesamt).
- **Sequenz-IDs:** Der Seed setzt feste IDs und korrigiert 10 Sequenzen per `setval`; `RESTART IDENTITY` je Test macht die nächste ID deterministisch. Ob irgendwo eine feste „nächste ID“ erwartet wird, habe ich nicht systematisch gesucht — die 8 + 5 Einzelläufe (alle grün) sprechen dagegen.

## Alte Befunde nachgeprüft

- **`docs/offene-befunde.md` Nr. 12 „init-scripts weicht vom Produktionsschema ab (16.09.) — IN ARBEIT“** → **behoben bestätigt**: `diff` von `init-scripts/01-create-schema.sql` und `backend/tests/schema/prod-schema.sql` ohne Kommentarzeilen leer; `02-migrationsstand.sql` gegen `prod-migrations.txt` identisch (53 Einträge); Wächter `backend/tests/schema/neuinstallation.test.js` vorhanden (baut zwei Wegwerf-DBs und vergleicht Tabellen, Views, Spalten, CHECKs). Doku ist nicht nachgezogen (BF-11).
- **`globalSetup.js` / `schemaDrift.test.js`, „Audit 22.08.2026“ (Test-Schema als Patchwork, `daily_verses` fehlte, TRUNCATE-Liste unvollständig)** → **behoben bestätigt**: `audit_konfi` hat 58 Tabellen, TRUNCATE-Liste 58/58, `fehlen: []`, `überzählig: []`; `daily_verses` mit UNIQUE vorhanden; alle 89 Migrationen in `schema_migrations` (`schemaDrift.test.js` prüft beides bei jedem Lauf).
- **`helpers/db.js` / `testApp.js`, „01.09.2026 sporadischer 404-Fehlschlag durch Nachläufer“ und `setupTests.js` „Parse Error 1 von 1200“** → **aus Code bestätigt**: `warteAufAlleNachwehen()` vor jedem TRUNCATE, `warteAufLiveUpdates()` (Befund 09.09.), `keepAlive: false`. 13 Dateien einzeln ohne einen Fehlschlag (1128 Tests) — kein Gegenbeweis, aber auch kein Beleg für Sporadik.
- **`vitest.config.ts` / `db.js` / `docker-compose.test.yml` / `ci.yml`, „zwischen 00:00 und 02:00 Berliner Zeit“ (01./02.09.2026)** → **behoben bestätigt** (Backend): `TZ: 'Europe/Berlin'` im Node-Prozess, `-c timezone=Europe/Berlin` je DB-Verbindung, `TZ`/`PGTZ` in Compose und CI-Service; `zeitzone.test.js` wacht über `heuteBerlin()`. Frontend nicht nachgezogen (BF-15).
- **`e2e/global-setup.ts` / `docker-compose.e2e.yml`, „30.08.2026: E2E lief faktisch nie (leere DB, Timeout)“** → **teils**: Schema wird eingehängt, Timeout 900 s — aber ohne Migrationsstand (BF-03).
- **`e2e/helpers/auth.ts`, „14.09.2026 Aenderungsanzeige legte die Suite lahm“** → **aus Code bestätigt**: `setzeAnzeigeMarker()` liest die Version aus `frontend/version.json` (2.3.0) statt fest zu verdrahten; `aenderungsanzeige.spec.ts` prüft den Overlay-Weg bewusst ohne Marker.
- **`ci.yml`, „01.09.2026 bcrypt fehlte im E2E-Job“** → **aus Code bestätigt**: Schritt `npm ci --ignore-scripts` in `backend/`.
- **`ci.yml`, „Lint SCHARF seit 31.08.2026“** → **weiter offen / unwirksam** (BF-07).
- **`tests/routes/eventBookingStats.test.js:126`, „28.08.2026 `.catch(() => {})` schluckte den Fehler“** → **behoben bestätigt** (Kommentar und Code; keine leeren `catch` um Erwartungen mehr in versionierten Tests).

## Geprüft und in Ordnung

- **TRUNCATE-Liste vollständig:** 58 Tabellen in `audit_konfi` (ohne `schema_migrations`) = 58 in `helpers/db.js` TRUNCATE_SQL; `material_tags`/`material_file_tags` aus dem Dump sind durch Migration 130 weg (reproduziert, `schema_experiment.js`).
- **Migrationslauf im Test vollständig und hart:** `globalSetup` wendet 36 offene Migrationen an und bricht bei Fehlern ab (Code gelesen; Lauf: „36 neue Migrationen“).
- **Seed deterministisch:** feste IDs für Orgs (1/2), Rollen (1–9), Nutzer (1–11), Jahrgänge, Kategorien, Aktivitäten, Badges, Levels, Events, Chat-Räume; 10 `setval`; Termin→Jahrgang-Zuordnung; `konfi_profiles.created_at` 3 Jahre zurück für den Rückblick (gelesen). `Math.random`/`Date.now()` in Tests (19 bzw. 72 Stellen) nur für eindeutige Namen, nie in Erwartungen (gegrept, Stichproben gelesen).
- **Keine übersprungenen oder leeren Tests:** 0 `it.skip`/`it.todo`/`.only` in Backend und Frontend; 0 `it` ohne Erwartung (Parser `ohne_expect.js` meldete 6, alle sechs von Hand als Fehlalarm des Parsers bei Anführungszeichen im Titel bestätigt); 0 leere `catch` um Erwartungen.
- **Gegenproben, die fallen (Datei → Test → Ergebnis):**
  - G01 `routes/teamer.js:285` Array → Objekt → `badgesV2.test.js` „liefert weiterhin ein ARRAY“: **fällt** (`expected false to be true`). Der Vertrag zu den Store-Apps ist geschützt.
  - G02 `middleware/rbac.js:162` Mitgliedschaftsprüfung (`X-Active-Organization`, 2.3.0) aus → `auth.test.js` „Nicht-Mitglieds-Org“: **fällt** (`expected 500 to be 403`).
  - G03 `utils/bookingUtils.js:834` Gemeinde-Filter der Buchung aus → `events.test.js` „Konfi aus Org 2 kann Event aus Org 1 NICHT buchen“: **fällt** (`expected 201 to be 404`).
  - G04 `utils/bookingUtils.js:51` Kapazitätsgrenze aus → „Bei vollem Event kommt Konfi auf Warteliste“: **fällt** (`expected 'confirmed' to be 'waitlist'`).
  - G05b `routes/events/buchung.js:203` Nachrücken aus → `events.test.js` „nach Stornierung rueckt er nach“: **fällt** (`expected 'waitlist' to be 'confirmed'`). (G05 gegen `nachrueckenLuecken.test.js` fiel nicht — die Datei prüft andere Routen: `opt-out`, `/participants/:id/status`, Admin-Löschung; Mutation traf den Pfad nicht.)
  - G06 `routes/events/verwaltung.js:1101` `requireAdmin` an `/cancel` entfernt → `rbacTermine.test.js` „der Termin bleibt aktiv“: **fällt** (`expected 200 to be 403`).
  - G07 `verwaltung.js:1145` Doppel-Absage-Riegel aus → `absagegrund-aendern.test.js` „zweiter /cancel“: **fällt** (`expected 500 to be 400`).
  - G08c/G08d `middleware/rbac.js:104,138` Soft-Revoke aus → `auth.test.js`: **2 fallen** (change-password, reset-password; altes Token per `generateTokenMitAlter` bekommt 200 statt 401), `passwortResetBeendetSitzung.test.js`: **2 fallen**. (G08a gegen `chat.test.js` „Soft-Revoke auch hier“ fiel nicht — `/api/chat/files/:filename` hat eine eigene Prüfung in `chat.js:1782`; Mutation traf den Pfad nicht.)
  - G09 `utils/chatRoomAccess.js:61` Teilnehmerprüfung aus → `chatRoomAccess.test.js` „Konfi2 darf NICHT“: **fällt** (`expected true to be false`).
  - G11 `routes/auth.js:182` Passwortvergleich aus → `auth.test.js` „falschem Passwort gibt 401“: **fällt** (`expected 200 to be 401`).
  - G10 `routes/challenges.js:59` `maySubmit` für Konfi immer wahr → `challenges.test.js` „Konfi kann NICHT einreichen“: **fällt nicht — Verhalten bleibt korrekt**, weil die vorgelagerte Sichtbarkeitsprüfung (`challenges.js:757-761`, „Kein Zugriff auf diese Challenge“) schon 403 liefert. Zwei Riegel hintereinander; der Test prüft das Verhalten, nicht die Zeile.
  - Nach jeder Gegenprobe: Datei aus Sicherung zurück, `git diff --quiet` je Datei leer (Skriptausgabe „zurückgesetzt, git diff leer“, 15/15).
- **Reihenfolgeabhängigkeit:** 13 Dateien einzeln grün — `events` (164), `wrapped` (171), `challenges` (156), `konfi` (107), `chat` (117), `konfi-management` (113), `teamer` (93), `organizations` (76), `roles` (15), `eventReminders` (16), `konfiLimit` (8), `einladungen` (17), `konfiInZweitgemeinde` (5). 103 Dateien leeren per `beforeEach`, 4 nur per `beforeAll` (`verbindungFreigabe*`, `schemaDrift`, `zeitzone` — lesend oder bewusst), 32 ohne DB.
- **Laufzeiten (Port 5438, 4 geteilte CPUs, Wanduhr je Datei / längster Einzeltest):** `events` 108 s / 3164 ms; `wrapped` 133 s / 1952 ms; `challenges` 211 s / 2593 ms (16 Tests ≥ 2 s); `konfi` 56 s / 1476 ms; `chat` 55 s / 1598 ms; `konfi-management` 53 s / 707 ms; `teamer` 42 s / 752 ms; `organizations` 35 s / 978 ms. **Kein Test ≥ 5 s**, Limit ist 10 s. Eigene Timeouts nur an den Schema-Wächtern (60–180 s `beforeAll`) und `uploadsAufDiePlatte.test.js:308` (30 s). `setTimeout` in Tests (38 Stellen) sind Fake-Server-Verzögerungen (`apmKennzahlen`, `apmCacheUndScanner`) oder Nachlauf-Wartezeiten ≤ 1,2 s (`chat.test.js:2200`); keine `retry`-Konfiguration in Vitest.
- **`--passWithNoTests`-Nachbau:** s. BF-08 (reproduziert, beide Richtungen).
- **init-scripts:** identisch mit `backend/tests/schema/*` (diff leer), README beschreibt den heutigen Ablauf korrekt, `refresh.sh` erzeugt exakt diese Dateien (gelesen).
- **`neuinstallation.test.js`, `migration064Indizes.test.js`, `schemaDrift.test.js`:** konkrete Erwartungen (`toEqual` auf Listen, verbotene und erlaubte Werte), eigene Wegwerf-DBs, Aufräumen im `afterAll` (gelesen).
- **`X-Active-Organization` (2.3.0) im Backend getestet:** 11 versionierte Dateien, darunter „Nicht-Mitglieds-Org → 403“ (`auth.test.js:1065,1095`, `orgWechselEigeneBuchung.test.js:209`), per Gegenprobe G02 wirksam.
- **`GET /teamer/badges` Antwortform:** `badgesV2.test.js:98-123` prüft `Array.isArray`, `.filter()`, Länge, Kopfzeilen `X-Badges-*-Total`; `/v2` separat als Objekt — genau der Vorfall vom 29.08. ist abgedeckt (G01).
- **Postgres 16 lokal vs. 15 Produktion:** keine 16-spezifische Syntax in Migrationen/Code (gegrept); Dump lädt fehlerfrei in 16.

## Nicht geprüft

- `npx playwright test` (Image-Pull 429, kein Browser) — E2E nur gelesen.
- Gesamtsuiten Backend/Frontend (Koordination).
- Laufzeit einzelner Frontend-Tests; Flakiness der Frontend-Suite über mehrere Läufe.
- Ob die in BF-04/BF-05 genannten Routen fachlich korrekt filtern (Sicherheitsbereich).
- Mutationstests im Frontend (analog Gegenprobe) — wegen des hohen Anteils an Quelltext-Tests (BF-02) wäre das der nächste sinnvolle Schritt.
- `docs/api/*.yaml` gegen die tatsächlichen Antworten (kein Vertragstest vorhanden; anderer Bereich).

## Auf Produktion nachzumessen

1. **Schema-Frische (BF-14):** `bash backend/tests/schema/refresh-schema.sh` ausführen und den neuen Dump gegen `audit_konfi` vergleichen — oder direkt in Produktion `pg_dump --schema-only --no-owner --no-privileges --no-comments` ziehen und mit `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,2` gegen die Test-DB diffen. Jede Abweichung ist eine Handänderung seit dem 22.08., die kein Test sieht.
2. **Migrationsstand:** `SELECT name FROM schema_migrations ORDER BY name;` in Produktion — erwartet 89 Einträge bis `159_gemeinde_einladungen.sql`. Fehlt eine, hat `database.js` sie still übersprungen (Backend-Log nach „Migration FAILED (uebersprungen“ durchsuchen).
3. **Zeitzone in Produktion:** `SHOW timezone;` (erwartet `Europe/Berlin`) und `SELECT version();` (erwartet 15.x) — Grundlage für BF-13/BF-15.
4. **E2E-Job-Log (GitHub Actions, `e2e-test`):** nach „ACHTUNG: 2 Migration(en) fehlgeschlagen“ suchen — bestätigt BF-03 im echten Lauf.
5. **Lint-Schritt in Actions:** in den Läufen seit 31.08. zählen, wie oft der Schritt „Lint (nur im PR geaenderte Dateien)“ tatsächlich ausgeführt wurde (BF-07).
