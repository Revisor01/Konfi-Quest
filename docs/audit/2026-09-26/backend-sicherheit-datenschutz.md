# Audit Backend-Sicherheit und Datenschutz — 26.09.2026

## Umfang und Methode

**Geprüft (gelesen):** `backend/createApp.js`, `server.js`, `database.js`,
`middleware/rbac.js`, `middleware/validation.js`, `utils/roleHierarchy.js`,
`orgMitglieder.js`, `orgOwnership.js`, `jahrgangsZugriff.js`, `chatRoomAccess.js`,
`passwordUtils.js`, `usernameGenerator.js`, `photoCrypto.js`, `photoStorage.js`,
`konfiDeletion.js`, `routes/auth.js`, `organizations.js`, `users.js`, `roles.js`,
`einladungen.js`, `docsAuth.js`, die Upload- und Auslieferungsstellen in
`routes/konfi.js`, `chat.js`, `material.js`, `challenges.js`, `activities.js`,
`events/checkin.js`, `events/teilnehmer.js`, die Löschpfade in `users.js`,
`organizations.js`, `services/backgroundService.js` (Aufbewahrung),
`services/emailService.js`, `services/losungService.js`, `scripts/cleanupOrphanPhotos.js`,
`frontend/src/services/absturzdiagnose.ts`, `analytics.ts`, das
Produktionsschema `backend/tests/schema/prod-schema.sql`, `deploy/compose.konfi_quest.yml`,
die Git-Historie (2172 Commits) und `docs/api/verwaltung-auth.yaml`.

**Ausgeführt:**

- Zwei temporäre Vitest-Dateien gegen `tests/helpers/testApp.js` auf Port 5436,
  danach gelöscht. Datei 1: **150 Zugriffe von Nutzer:innen aus Organisation 1
  auf Objekte aus Organisation 2** über alle Router (Konfi, Termin, Jahrgang,
  Chatraum, Nachricht, Datei, Challenge, Beitrag, Material, Antrag, Badge,
  Kategorie, Level, Zertifikat, Einladung, Einladungscode, Postfach, Rückblick,
  Organisation), in drei Läufen (als `admin`, als `org_admin`, mit korrigierten
  Körpern), plus 11 Positivkontrollen in der eigenen Organisation. Datei 2:
  Rechteausweitung, Einladungen, Authentifizierung, HTTP-Härtung, Löschkonzept.
- Eigene Datenbank `audit_schema` aus Produktionsdump + offenen Migrationen
  (60 Tabellen) für die Analyse der Fremdschlüssel-Löschregeln; danach gedroppt.
- `npm audit --json` im Backend.
- Messung des Passwortraums der generierten Bibelstellen-Passwörter.
- Greps über Repo und Git-Historie nach Geheimnissen, Serveradressen,
  String-Interpolation in SQL, sensiblen Log-Ausgaben.

**Bewusst nicht geprüft:** Die Rate-Limiter aus `server.js` sind in der Test-App
nicht eingehängt (createApp erhält keine Limiter); ihr Verhalten hinter dem
Proxy ist nur aus Code und Kommentaren ableitbar. Socket.IO wurde gelesen,
nicht mit einem echten Client verbunden. Die Kopplung an Firebase/APNs
(Push-Inhalte auf Google-/Apple-Servern) liegt im Frontend-/Push-Bereich.
Store-Apps 2.2.x wurden nicht dekompiliert.

## Zusammenfassung

22 Befunde: **1 KRITISCH, 5 HOCH, 7 MITTEL, 9 NIEDRIG.** Die Mandantentrennung
hält: In 150 gezielten Fremdzugriffen gab es **keinen Datenabfluss zwischen
Gemeinden**; 100-mal 404, 29-mal 403, der Rest Validierungsfehler oder leere,
org-gefilterte Listen. Die Einzelfall-Prüfungen (Jahrgangsbindung, Chatraum-
Teilnehmerschaft, Datei-Auslieferung nur an Berechtigte, AES-256-GCM mit
Zufalls-IV, parametrisiertes SQL, JWT-Verifikation, Löschkaskade) haben gehalten.

Die drei wichtigsten Punkte: **(1)** Ein Org-Admin kann das Passwort jedes
Super-Admin-Kontos setzen, das dieselbe Stamm-Organisation hat — auch der
echten `super_admin`-Rolle — und übernimmt damit die gesamte Instanz
(reproduziert; als „N1" seit 22.08.2026 in der API-Doku als offen geführt).
**(2)** Zwei Apple-Signaturschlüssel (`.p8`) liegen in der öffentlichen
Git-Historie; ob sie widerrufen sind, ist aus dem Repo nicht ersichtlich.
**(3)** Die neue Gemeinde-Einladung (2.3.0) lädt auch **Konfis fremder
Gemeinden** als Teamer:in ein und verrät jedem Org-Admin zu jeder E-Mail-Adresse
im System Anzeigename und Benutzername — auch von Minderjährigen.

## Release-Empfehlung für den Bereich

**nicht freigeben** — bis BF-01 (Passwort fremder Super-Admin-Konten) und BF-03
(Einladung fremder Konfis, Personenabfrage systemweit) behoben und mit Tests
(verbotener und erlaubter Fall) belegt sind. BF-02 (Schlüssel in der Historie)
ist keine Code-Änderung, sondern eine Betriebsfrage: Widerruf bei Apple
bestätigen, sonst ebenfalls blockierend.

## Befunde

### BF-01: Org-Admin übernimmt Super-Admin-Konten derselben Organisation
- **Schwere:** KRITISCH
- **Status:** behoben 26.09.2026 — `istSuperAdminKonto` (Rolle `super_admin` oder Flag `is_super_admin`) in `checkUserHierarchy` (PUT, DELETE, Jahrgänge) und inline in `reset-password`: nur ein Super-Admin darf ein solches Konto verwalten, sonst 403. Tests für alle vier Wege verboten und erlaubt in `users.test.js`.
- **Fundstelle:** `backend/routes/users.js:933-940` (`isOrgAdmin && isSameOrg`, kein Rollencheck des Ziels), `users.js:942-943` (Kommentar behauptet „Nur super_admin ist geschützt"), `backend/utils/roleHierarchy.js:31-34` (`org_admin` darf `org_admin` verwalten — das Flag `is_super_admin` kennt die Hierarchie nicht), `docs/api/verwaltung-auth.yaml:89-91` (als N1 offen geführt)
- **Kennzeichnung:** reproduziert — temporärer Test: `PUT /api/admin/users/10/reset-password` (Ziel: Rolle `super_admin`, Org 1) durch `orgadmin1` → **200**; `PUT /api/admin/users/11/reset-password` (Ziel: `org_admin` mit `is_super_admin`-Flag, Simons Konstellation) → **200**; `PUT /api/admin/users/11 {password}` → **200**; `DELETE /api/admin/users/11` → **200**. Anschließend `POST /api/auth/login` als `orgadminsuper` mit dem gesetzten Passwort → 200, `is_super_admin: true`, `GET /api/organizations` → 200 mit allen Organisationen.
- **Beschreibung:** Drei Wege setzen oder löschen ein Konto mit Super-Admin-Rechten, sobald es dieselbe `users.organization_id` trägt wie der aufrufende Org-Admin: `reset-password` prüft nur Rolle des Aufrufers und Org-Gleichheit; `PUT /:id` und `DELETE /:id` laufen durch `checkUserHierarchy`, das für ein `org_admin`-Ziel `true` liefert und `is_super_admin` nicht betrachtet. Sein sollte: Ziel mit Rolle `super_admin` oder Flag `is_super_admin` ist für jeden außer einem Super-Admin unantastbar.
- **Auswirkung aus Nutzersicht:** Jeder zweite Org-Admin einer Gemeinde, in der ein Super-Admin sein Stammkonto hat, kann dessen Passwort setzen, sich anmelden und danach **alle Gemeinden** sehen, anlegen, löschen, Tarife ändern, systemweit nach Personen suchen. Für die EKD-Ausrollung ist das die Übernahme der ganzen Instanz durch eine Gemeinde.
- **Beleg:** Testausgabe: `reset-password superAdmin(10) durch orgAdmin1: 200 {"message":"Passwort erfolgreich zurückgesetzt"} -> Login mit neuem Passwort moeglich: true`; `Login als orgadminsuper mit uebernommenem Passwort: 200, is_super_admin=true -> GET /api/organizations (nur super_admin): 200, 2 Organisationen sichtbar`; `DELETE /users/11 durch orgAdmin1: 200`.
- **Empfehlung:** In `reset-password`, `PUT /:id`, `DELETE /:id` und `checkUserHierarchy` das Ziel laden und bei `role_name = 'super_admin' OR is_super_admin = true` mit 403 abweisen, sofern der Aufrufer nicht selbst Super-Admin ist. Test für verbotenen (org_admin → super_admin) und erlaubten Fall (super_admin → org_admin). API-Doku N1 als behoben datieren.

### BF-02: Apple-Signaturschlüssel und Server-Zugang in der öffentlichen Git-Historie
- **Schwere:** HOCH (KRITISCH, falls die Schlüssel nicht widerrufen sind)
- **Fundstelle:** Commit `02c8b37f` (23.03.2026) fügt `docs/AuthKey_7AQA623H3T.p8` und `docs/AuthKey_A29U7SN796.p8` hinzu (je 257 Byte, Blobs `9e82395a…`, `600830143…`); Commit `cb4d4372` (24.03.2026) entfernt sie nur aus dem Arbeitsbaum. Derselbe Commit `02c8b37f` fügt `backend/.claude/settings.local.json` mit `ssh root@server.godsapp.de …` und Container-/DB-Namen hinzu.
- **Kennzeichnung:** reproduziert — `git log --all --diff-filter=A -- 'docs/AuthKey_*.p8'`, `git log --all -S'BEGIN PRIVATE KEY'` (2 Treffer, beide diese Dateien), `curl https://api.github.com/repos/Revisor01/Konfi-Quest` → `"private": false, "visibility": "public"`.
- **Beschreibung:** Ein `.p8`-Schlüssel (APNs-Auth-Key oder App-Store-Connect-API-Key) ist ein Signaturschlüssel des Apple-Entwicklerkontos; einmal öffentlich, gilt er als kompromittiert, bis er im Apple-Portal widerrufen wird. Das Entfernen aus dem Tracking ändert an der Historie nichts. Die historische `portainer-stack.yml` enthielt nur `${…}`-Platzhalter (0 Klartextwerte), das ist in Ordnung.
- **Auswirkung aus Nutzersicht:** Mit einem gültigen APNs-Key kann ein Dritter Push-Nachrichten im Namen der App an alle iOS-Geräte senden (Phishing-Text an Konfis); mit einem App-Store-Connect-Key sind je nach Rolle Builds und Metadaten zugänglich.
- **Beleg:** `cb4d4372 2026-03-24 chore(260324-lt3): APNs Keys und portainer-stack.yml aus Git-Tracking entfernen` — `docs/AuthKey_7AQA623H3T.p8 | 6 ----`, `docs/AuthKey_A29U7SN796.p8 | 6 ----`. Inhalt der Schlüssel wurde für diesen Bericht bewusst nicht ausgegeben.
- **Empfehlung:** Widerruf beider Key-IDs (7AQA623H3T, A29U7SN796) im Apple-Portal bestätigen oder jetzt durchführen; neue Keys nur als Secrets. Historie mit `git filter-repo` bereinigen ist optional — der Widerruf ist das Entscheidende. `settings.local.json` steht in `.gitignore`, gut; die SSH-Zeile bleibt trotzdem in der Historie.

### BF-03: Gemeinde-Einladung lädt fremde Konfis ein und verrät Personen systemweit
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/einladungen.js:91-98` (Ziel per Benutzername ODER E-Mail systemweit, ohne Rollenprüfung des Ziels), `:151-160` (Antwort mit `display_name`, `username`, `user_id`), `:100-104` (404 bei unbekannter Kennung); Gegenstück `backend/routes/organizations.js:1172-1174` (Super-Admin-Weg verbietet Konfis ausdrücklich)
- **Kennzeichnung:** reproduziert — `POST /api/einladungen {kennung:'konfi3', role_id:2}` als `orgadmin1` → **201** `{"user_id":6,"display_name":"Test Konfi 3","username":"konfi3","role_name":"teamer"}`; `konfi3` (Konfi, Org 2) nimmt an → 200; `POST /api/auth/switch-org {organization_id:1}` → 200 `role=teamer`; `GET /api/admin/konfis` mit `X-Active-Organization: 1` → 200. Enumeration: `kennung:'niemand@example.org'` → 404, `kennung:'kind@example.org'` (E-Mail eines Org-2-Konfis) → 201 mit Anzeigename.
- **Beschreibung:** Die Route prüft die *zu vergebende* Rolle („niemals konfi"), nicht die Rolle der *eingeladenen Person*. Ein 13-jähriger Konfi einer anderen Gemeinde kann so Teamer:in in einer fremden Gemeinde werden; sobald ihm dort ein Jahrgang zugewiesen wird, sieht er deren Konfis, Anträge, Anwesenheit, Chats. Zweitens beantwortet die Route jedem Org-Admin für jede E-Mail-Adresse und jeden Benutzernamen im System, ob es das Konto gibt, und liefert Anzeigename und Benutzername — auch für Konfis anderer Gemeinden. Der Kommentar in `einladungen.js:88-90` erkennt das Risiko („Bestand fremder Gemeinden durchblättern") und schließt nur die Teilsuche aus, nicht die Exaktabfrage.
- **Auswirkung aus Nutzersicht:** Eine Konfi bekommt Push und E-Mail „Einladung von <fremder Gemeinde>" mit Rolle Teamer:in — ohne dass ihre eigene Leitung davon weiß. Eine Leitung kann anhand einer Klassenliste mit E-Mail-Adressen prüfen, welche Kinder anderer Gemeinden ein Konfi-Quest-Konto haben.
- **Beleg:** Testausgabe: `Einladung konfi3 als teamer durch orgAdmin1: 201 {"id":1,"user_id":6,"display_name":"Test Konfi 3","username":"konfi3",…}`, `konfi3 switch-org -> 1: 200 role=teamer`, `Einladung unbekannte Adresse: 404; bekannte Adresse eines Org2-Konfis: 201 display_name=Test Konfi 3 username=konfi3`.
- **Empfehlung:** Ziel mit Rolle `konfi` (Stammrolle) ablehnen wie in `organizations.js:1172`. Antwort ohne `display_name`/`username`/`user_id`, einheitlich 202 „Falls es ein Konto gibt, wurde eingeladen" — oder Einladung nur an bereits bekannte Teammitglieder (z. B. nur E-Mail, keine Bestätigung der Existenz). Handbuch und CHANGELOG entsprechend; Test für beide Fälle.

### BF-04: Generierte Passwörter haben 14,9 Bit; kein Wechselzwang, keine Kontosperre
- **Schwere:** HOCH
- **Fundstelle:** `backend/utils/passwordUtils.js:56-58` (`generateBiblicalPassword`), `backend/routes/konfi-management.js:215` (Konfi-Anlage) und `:600` (Neuvergabe), `backend/server.js:294-302` (`authLimiter`: 300 Fehlversuche/15 min **je IP**, `MemoryStore` je Prozess), kein Treffer für `failed_login|lockout|login_attempts` im Backend
- **Kennzeichnung:** gemessen (`node -e` gegen `bibelVerszaehlung.js`): 31 168 Stellen, davon **30 772 ≥ 8 Zeichen = 14,9 Bit**; aus Code gelesen: kein Zwang zum Passwortwechsel (kein `must_change_password`-Feld im Schema, kein Frontend-Fluss), keine Sperre je Konto.
- **Beschreibung:** Jeder von der Leitung angelegte Konfi erhält ein Passwort wie „Johannes7,47" aus 30 772 Möglichkeiten; die Policy erfüllt es formal (Groß-/Kleinbuchstabe, Ziffer, Komma). Wer es nie ändert — das Handbuch empfiehlt es nur („sollte es danach im Profil ändern", `35-passwoerter.md:71`) —, ist mit **25,6 Stunden je IP, 2,6 Stunden mit 10 IPs** vollständig durchprobierbar. Der Limiter zählt je Prozess: bei drei Backend-Replikas hinter Traefik (`deploy/compose.konfi_quest.yml`) sind es effektiv bis zu 900 Fehlversuche je IP und Viertelstunde. Eine Sperre nach n Fehlversuchen **je Konto** gibt es nicht.
- **Auswirkung aus Nutzersicht:** Wer den Benutzernamen eines Konfis kennt (Muster `vorname.nachname`, öffentlich prüfbar über `GET /api/auth/check-username/:username`), kommt in vertretbarer Zeit in dessen Konto: Chats, Fotos, Anwesenheit, Konfispruch.
- **Beleg:** `Stellen gesamt: 31168 | >=8 Zeichen (Passwortraum): 30772 | log2 = 14.9 Bit | Beispiel: Johannes7,47 | Policy-Fehler: null | Durchprobieren bei 300 Fehlversuchen/15min je IP: 25.6 Stunden je IP; bei 10 IPs: 2.6 Stunden`.
- **Empfehlung:** Pflicht-Passwortwechsel nach Erstanmeldung mit Einmalpasswort (Flag am Konto, Frontend-Fluss), Kontosperre oder exponentielle Verzögerung nach z. B. 10 Fehlversuchen je Benutzername (unabhängig von der IP), Limiter-Store geteilt (Postgres/Redis) statt je Replica.

### BF-05: Passwort-Reset-Limiter zählt je `req.ip` — hinter dem Proxy für alle gleich
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/auth.js:19-25` (`passwordResetLimiter` ohne `keyGenerator`, 5/15 min), `backend/server.js:257-260` und `:288-292` (Kommentar: „req.ip war für ALLE die Proxy-IP … der Limiter zählte GLOBAL über alle Nutzer"), `:261-277` (`clientIp` liest `X-Real-IP` — nur für die Limiter in `server.js`)
- **Kennzeichnung:** teilweise reproduziert — Test: 6 × `POST /api/auth/request-password-reset` mit verschiedenen Adressen → `200,200,200,200,200,429`, also je Absender-IP; das Proxy-Verhalten selbst ist aus dem eigenen Produktionsbefund in `server.js` übernommen, nicht neu gemessen.
- **Beschreibung:** Alle Limiter in `server.js` wurden nach dem Befund auf `X-Real-IP` umgestellt; der in `auth.js` definierte Reset-Limiter nicht. Trifft die Beschreibung aus `server.js` weiter zu, gilt: **fünf Passwort-Reset-Anfragen je Viertelstunde für die gesamte Plattform**. Bei 10 000–25 000 Nutzer:innen ist die Funktion damit praktisch nicht verfügbar — und ein Dritter kann sie mit fünf Anfragen für alle sperren.
- **Auswirkung aus Nutzersicht:** „Zu viele Passwort-Reset-Anfragen. Bitte warte 15 Minuten." — obwohl man selbst zum ersten Mal anfragt.
- **Beleg:** `request-password-reset 6x: 200,200,200,200,200,429`.
- **Empfehlung:** Limiter in `server.js` definieren und wie die anderen mit `clientIp` schlüsseln, zusätzlich je Ziel-E-Mail begrenzen; auf Produktion messen (siehe unten).

### BF-06: Spalte `konfi_profiles.password_plain` — möglicher Altbestand an Klartextpasswörtern
- **Schwere:** HOCH (KRITISCH, falls in Produktion Werte stehen)
- **Fundstelle:** `backend/tests/schema/prod-schema.sql:1186` (`password_plain text`), `init-scripts/01-create-schema.sql:1202`, `backend/routes/konfi-management.js:681` (einzige Code-Stelle: `SET password_plain = NULL` bei Neuvergabe), keine Migration, die die Spalte leert oder entfernt; `tests/schema/schemaDrift.test.js:76-80` erwartet die Spalte
- **Kennzeichnung:** aus Code gelesen. Ob Werte vorhanden sind, lässt sich nur in Produktion prüfen.
- **Beschreibung:** Die Spalte stammt aus der SQLite-Zeit und wird heute weder geschrieben noch gelesen. Sie wird aber nur für Konfis geleert, deren Passwort seither neu generiert wurde. Alle anderen Zeilen behalten ihren Stand — und mit jedem Dump (`docs/offene-befunde.md` Nr. 3: nächtliche Dumps) wandert er in jede Sicherung.
- **Auswirkung aus Nutzersicht:** Falls befüllt: Wer Datenbank oder Backup lesen kann, liest die Passwörter Minderjähriger im Klartext — und viele Kinder verwenden Passwörter mehrfach.
- **Beleg:** `grep -rn password_plain backend/` → nur Schema, Drift-Test und die NULL-Zuweisung.
- **Empfehlung:** Migration `UPDATE konfi_profiles SET password_plain = NULL` (additiv, bricht nichts), später `DROP COLUMN`; Drift-Test anpassen. Vorher in Produktion zählen (siehe unten).

### BF-07: Soft-gelöschte Konfis bleiben angemeldet und nutzen die API weiter
- **Schwere:** MITTEL
- **Fundstelle:** `backend/services/backgroundService.js:1506-1521` (setzt `deleted_at` 60 Tage nach Konfirmation), `backend/routes/auth.js:158-185` (Login ohne `deleted_at`-Filter), `backend/middleware/rbac.js:116-135` (kein `deleted_at`-Check); dagegen `server.js:104-109` (Socket-Auth) und `chat.js:1771-1775` (Datei-Auslieferung) filtern `deleted_at IS NULL`
- **Kennzeichnung:** reproduziert — `UPDATE users SET deleted_at = NOW() WHERE id = 1`, dann `POST /api/auth/login` → **200**, `GET /api/chat/rooms` → **200**, `GET /api/konfi/profile` → 404.
- **Beschreibung:** Der Soft-Delete blendet die Person für die Leitung aus (alle Listen filtern `deleted_at IS NULL`), lässt sie aber selbst weiterarbeiten: anmelden, Chats lesen und schreiben, Termine buchen. Zwischen Tag 60 und 120 nach der Konfirmation ist das ein Zwischenzustand, den niemand mehr sieht, aber der Betroffene noch bedient.
- **Auswirkung aus Nutzersicht:** Ein Konfi schreibt im Jahrgangs-Chat, taucht aber in keiner Teilnehmerliste der Leitung mehr auf; Push-Empfängerlisten (`orgMitglieder.js`) lassen ihn aus.
- **Beleg:** `deleted_at gesetzt: Login 200, GET /konfi/profile 404, GET /chat/rooms 200`.
- **Empfehlung:** Entweder `deleted_at IS NULL` in Login, Refresh und `rbac.js` (wie Socket-Auth) — oder den Soft-Delete auf `is_active = false` abbilden, das überall geprüft wird.

### BF-08: Refresh-Token-Gnadenfrist ist unbegrenzt wiederverwendbar; keine Gerätebindung
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/auth.js:1194-1218` (Grace-Window 5 Minuten, Kommentar „einmalig+kurz nutzbar"), `:1296-1299` (neues Paar ohne Revoke im Grace-Pfad), Schema `refresh_tokens` (keine `device_id`, Migration 068)
- **Kennzeichnung:** reproduziert — Login, dann dreimal `POST /api/auth/refresh` mit demselben (bereits rotierten) Token → `200, 200, 200`, drei neue Paare, danach **3 offene Refresh-Tokens** für ein Konto.
- **Beschreibung:** Ein einmal rotierter Token bleibt fünf Minuten lang ein Generator für beliebig viele frische 90-Tage-Tokens. Damit fehlt, was Rotation eigentlich leisten soll: die Erkennung einer Wiederverwendung (Diebstahl) und der Widerruf der Token-Familie. Eine Bindung an das Gerät (`device_id` gibt es bei Push-Tokens, nicht bei Refresh-Tokens) fehlt ebenfalls.
- **Auswirkung aus Nutzersicht:** Wird ein Refresh-Token abgegriffen (Gerätesicherung, Logdatei, Proxy), hat der Angreifer 90 Tage Zugriff, ohne dass der Wechsel auffällt — bis die Person ihr Passwort ändert.
- **Beleg:** `Refresh mit altem Token: 1.=200 2.=200 3.=200 (neue Paare: 3) -> offene Refresh-Tokens des Nutzers danach: 3`.
- **Empfehlung:** Im Grace-Pfad kein neues Paar ausgeben, sondern das zuletzt ausgegebene zurückliefern (oder Grace auf genau eine Wiederverwendung begrenzen); bei Wiederverwendung außerhalb des Fensters alle Tokens des Kontos widerrufen; `device_id` mitführen.

### BF-09: SMTP ohne Zertifikatsprüfung
- **Schwere:** MITTEL
- **Fundstelle:** `backend/server.js:233-235` und `backend/services/emailService.js:39-41` (`tls: { rejectUnauthorized: false }`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der Mailversand akzeptiert jedes Zertifikat. Über diesen Kanal gehen Passwort-Reset-Links (`auth.js:705`), Gemeinde-Einladungen und die Anwesenheits-/Konfispruch-Listen ganzer Jahrgänge (`emailService.js:370-393`, Namen Minderjähriger).
- **Auswirkung aus Nutzersicht:** Wer sich zwischen Backend und Mailserver setzen kann, liest Reset-Links mit und setzt fremde Passwörter.
- **Beleg:** Codeausschnitt `tls: { rejectUnauthorized: false }` an beiden Stellen.
- **Empfehlung:** Entfernen; wenn der Mailserver ein eigenes CA-Zertifikat nutzt, dieses per `ca:` mitgeben.

### BF-10: Deaktivierung und Löschung leeren den RBAC-Cache nicht
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/users.js:354-356` (`invalidateUserCache` nur bei `role_id`), `users.js:414-648` (DELETE ohne Invalidierung), `backend/middleware/rbac.js:11-12` (30 s TTL)
- **Kennzeichnung:** reproduziert — `PUT /api/admin/users/3 {is_active:false}`, unmittelbar danach `GET /api/teamer/profile` mit der alten Sitzung → **200** (erwartet 401).
- **Beschreibung:** Nach Deaktivierung arbeitet die alte Sitzung bis zu 30 Sekunden weiter; Sockets werden getrennt, HTTP nicht. Bei drei Replikas gilt der Cache je Prozess, `invalidateUserCache` erreicht ohnehin nur die Replica, die den PUT bearbeitet hat (dasselbe gilt für alle anderen Aufrufer der Funktion).
- **Auswirkung aus Nutzersicht:** „Zugang deaktiviert" wirkt nicht sofort; im Mehrfach-Replica-Betrieb wirkt die Invalidierung nur auf einer von drei Instanzen bis zum TTL-Ablauf.
- **Beleg:** `Deaktivierung: vorher 200, unmittelbar danach 200 (401 erwartet)`.
- **Empfehlung:** `invalidateUserCache` auch bei `is_active` und DELETE aufrufen; besser `token_invalidated_at` setzen (wirkt replikaübergreifend, wird in `rbac.js` auch für gecachte Einträge geprüft).

### BF-11: Bonuspunkte an fremden Konfi enden mit 500, Org-Grenze nur durch spätes UPDATE
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/konfi-management.js:1161-1168` (`darfKonfi` prüft Jahrgang, für `org_admin` ohne Org-Prüfung), `:1180-1191` (INSERT in `bonus_points` mit fremder `konfi_id`, danach UPDATE mit `u.organization_id = $3` → 0 Zeilen → `throw` → ROLLBACK → 500); gleiches Muster `:1351`
- **Kennzeichnung:** reproduziert — `POST /api/admin/konfis/6/bonus-points` als `orgadmin1` → **500** `{"error":"Datenbankfehler"}`; DB danach unverändert (`bonus_points`-Zeilen: 0, Punkte 0/0).
- **Beschreibung:** Es fließen keine Daten, aber die Isolation hängt an einem Nebeneffekt (Rowcount) statt an einer Prüfung vorab; die Route liefert 500 statt 404 und schreibt einen Stacktrace ins Log. `darfKonfi` (`utils/jahrgangsZugriff.js:101-116`) lädt `konfi_profiles` ohne `organization_id` — jede weitere Route, die es allein als Zugriffsprüfung nutzt, hat dieselbe Schwäche.
- **Auswirkung aus Nutzersicht:** Fehlermeldung „Datenbankfehler" statt „nicht gefunden"; im APM ein Serverfehler.
- **Beleg:** `WIRKUNG bonus-points Org2-Konfi: 500 {"error":"Datenbankfehler"}; Punkte vorher {"gottesdienst_points":0,"gemeinde_points":0} nachher {…gleich…}; bonus_points-Zeilen: 0`.
- **Empfehlung:** `darfKonfi` um `organization_id` erweitern (`WHERE user_id = $1 AND organization_id = $2`) — dann greift die Grenze an allen Aufrufern zugleich.

### BF-12: Serveradressen, IP und SMTP-Nutzer im öffentlichen Repo
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:74` (`SMTP_HOST: server.godsapp.de`), `:76` (`SMTP_USER: moin@…`), `:85`, `:146`, `:221` (`extra_hosts: "server.godsapp.de:213.109.162.132"`), `backend/server.js:226,230` und `backend/services/emailService.js:32` (Fallback-Host/-Nutzer im Code), `docs/api/ABRISS.md:70,186`; historisch `backend/.claude/settings.local.json` mit `ssh root@server.godsapp.de`
- **Kennzeichnung:** reproduziert (grep, `git show 02c8b37f:backend/.claude/settings.local.json`)
- **Beschreibung:** CLAUDE.md: „Passwörter, Tokens, Serveradressen und Betriebsdoku gehören nicht hinein." Die Compose-Datei nennt Host, IP und Login-Namen des Mailkontos; der Code trägt denselben Host als Default. Zusammen mit BF-04/BF-05 (Brute-Force) ist der Mail-Login-Name der halbe Zugang zum Postausgang, der Reset-Links verschickt.
- **Auswirkung aus Nutzersicht:** keine direkte; Angriffsfläche des Betriebs.
- **Beleg:** grep-Ausgabe oben.
- **Empfehlung:** Hosts/IP/Nutzer aus Compose und Code in Umgebungsvariablen ohne Default; `docs/api/ABRISS.md` bereinigen.

### BF-13: Rate-Limits gelten je Replica und vertrauen `X-Real-IP` ungeprüft
- **Schwere:** MITTEL
- **Fundstelle:** `backend/server.js:261-277` (`clientIp` nimmt `X-Real-IP` vor `req.ip`), alle `rateLimit({...})`-Blöcke ohne `store` (MemoryStore je Prozess), `deploy/compose.konfi_quest.yml` (backend, backend2, backend-test)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Jede Replica zählt für sich; Traefik verteilt ~50/50 (Kommentar in der Compose-Datei). Alle Limits sind damit faktisch mit der Replica-Zahl zu multiplizieren. `X-Real-IP` wird ohne Prüfung übernommen, dass er vom eigenen Apache stammt — erreicht eine Anfrage Traefik oder das Backend auf einem anderen Weg (oder reicht Apache einen vom Client gesetzten Header durch), setzt der Angreifer seine „IP" selbst und umgeht jedes Limit.
- **Auswirkung aus Nutzersicht:** keine direkte; schwächt BF-04.
- **Beleg:** kein `store:` in `server.js`; `if (real …) return real.trim();`.
- **Empfehlung:** Gemeinsamer Store (z. B. `rate-limit-postgresql` — die DB ist da) und `X-Real-IP` nur akzeptieren, wenn `req.socket.remoteAddress` zur Proxy-Allowlist gehört; in Produktion prüfen, ob Apache den Header überschreibt (siehe unten).

### BF-14: Benutzernamen Minderjähriger und Freitext in Server-Logs
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/auth.js:155` (`Login-Versuch: <username>` bei jedem Login), `:177`, `:183`, `:192`, `:199`; `backend/routes/notifications.js:725-737` (`push-diagnose` loggt `user=<id>` und bis 200 Zeichen Freitext `hinweis`); `backend/routes/jahrgaenge.js:748` (Admin-E-Mail im Log)
- **Kennzeichnung:** reproduziert — `console.warn`-Spy beim Login: `["Login-Versuch: konfi1","Login fehlgeschlagen: Falsches Passwort für 'konfi1'"]`
- **Beschreibung:** Benutzername = `vorname.nachname` eines Kindes, jede Anmeldung eine Zeile. Docker-Logs rotieren (10 MB × 3), landen aber in jeder Log-Sammlung. Der Freitext aus `push-diagnose` kommt vom Client und kann alles enthalten.
- **Empfehlung:** Nur Nutzer-ID loggen, Fehlversuche zählen statt benennen; Freitext nicht protokollieren.

### BF-15: JWT trägt E-Mail und Anzeigename im Klartext
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/auth.js:215-223`, `:654-663`, `:1282-1291`, `:1061-1069`
- **Kennzeichnung:** reproduziert — Claims: `id, type, display_name, email, organization_id, role_name, is_super_admin, iat, exp`
- **Beschreibung:** Access-Tokens sind nur base64-kodiert; sie liegen im Gerätespeicher, in Logs von Proxys und in Query-Parametern (`chat.js:1743` erlaubt `?token=` für Video-Elemente — URL-Logging). Für die Autorisierung braucht der Server nur `id`, `iat`, `active_organization_id`.
- **Empfehlung:** E-Mail und Anzeigename aus dem Token nehmen (Apps lesen `user` aus der Login-Antwort, nicht aus dem Token — vorher gegen Store-Apps prüfen).

### BF-16: Fremde IDs werden teils mit 200/leer oder 409 statt 404 beantwortet
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/categories.js:101-115` und `backend/routes/teamer.js:542-552` (Nutzungsprüfung vor Org-Prüfung → 409 mit Zählern), `konfi-management.js` `GET /:id/event-points`, `GET /:id/attendance-stats`, `events/checkin.js:310-343` (`attendance-count`), `konfi.js:1452-1518` (`events/:id/participants`), `material.js:387-417` (`by-event`), `teamer.js:574-590` (`:userId/certificates`), `chat.js:596-660` (`POST /rooms` verwirft fremde Teilnehmer still)
- **Kennzeichnung:** reproduziert — `DELETE /api/admin/categories/3` (Org 2) als `orgadmin1` → `409 "Kategorie kann nicht gelöscht werden: 1 Aktivität(en) zugeordnet."`; `DELETE /api/teamer/certificate-types/1` → `409 "… bereits im Team vergeben."`; sechs Routen → `200 []`/`200 {…:0}`; `POST /api/chat/rooms` mit Org-2-Personen → `200 {"room_id":5}`, Raum enthält nur den Ersteller.
- **Beschreibung:** Kein Datenabfluss (alle Listen sind org-gefiltert), aber die 409er verraten Existenz und Nutzung fremder Objekt-IDs, und stilles Weglassen von Teilnehmern lässt die Leitung glauben, der Raum sei wie gewünscht angelegt.
- **Empfehlung:** Org-Prüfung vor der Nutzungsprüfung; 404 für fremde IDs; `POST /rooms` mit 400 antworten, wenn Teilnehmer nicht zur Organisation gehören.

### BF-17: Body-Parser-Fehler enden als 500 „Something went wrong!"
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/createApp.js:602-620` (Fehlerhandler kennt nur `LIMIT_FILE_SIZE`), `:129` (`express.json()` mit Standard 100 kB)
- **Kennzeichnung:** reproduziert — ungültiges JSON → 500; 200-kB-Body → 500 (statt 400/413); kein Stacktrace beim Client, aber `console.error(err.stack)` je Anfrage.
- **Beschreibung:** Jeder Client-Fehler dieser Art wird als Serverfehler gezählt (APM, `/api/metrics`) und mit vollem Stack geloggt — mit 2000 Anfragen je Viertelstunde und Konto lässt sich das Log fluten.
- **Empfehlung:** `err.type === 'entity.too.large'` → 413, `err.type === 'entity.parse.failed'` → 400, ohne Stack.

### BF-18: Öffentliche Endpunkte verraten Version/Commit und Kontonamen
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/createApp.js:394-414` (`/api/status` ohne Auth: `version`, `commit`, `uptimeSeconds`), `backend/routes/auth.js:866-892` (`check-username` ohne Auth, nur Global-Limiter), `docs/api/verwaltung-auth.yaml:49-52` (als N3 offen)
- **Kennzeichnung:** reproduziert — `/api/status` → `{"status":"OK","version":"1.0.1","commit":"unknown",…}`; `check-username/konfi1` → `{"available":false}`
- **Beschreibung:** Mit `vorname.nachname` als Muster lässt sich prüfen, welche Kinder eines Ortes ein Konto haben — 2000 Namen je Viertelstunde und IP. N3 ist seit 22.08.2026 offen.
- **Empfehlung:** `check-username` nur mit gültigem Einladungscode im selben Request oder eigener Limiter (z. B. 20/15 min); `/api/status` auf `status` und `checks` reduzieren.

### BF-19: Aufräum- und Verschlüsselungsskripte kennen `uploads/challenges/` nicht
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/scripts/cleanupOrphanPhotos.js:18-31` (requests, chat, material), `backend/scripts/encryptExistingPhotos.js:22-24` (dieselben drei)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Challenge-Beiträge (Fotos, Sprachaufnahmen, Videos von Konfis, bis 50 MB) haben keinen Sicherheitsnetz-Lauf für Waisen; die Löschpfade räumen sie zwar mit, aber genau für deren Fehlerfälle existiert das Skript.
- **Empfehlung:** Ziel `uploads/challenges` mit `SELECT file_path FROM challenge_submissions` ergänzen.

### BF-20: Text-Uploads ohne Inhaltsprüfung
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/chat.js:1131-1133`, `backend/routes/material.js:848-851` (`text/plain`, `text/csv` „Header vertrauen")
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Wer `text/plain` deklariert, lädt beliebigen Inhalt hoch (z. B. HTML). Auslieferung ist entschärft: Chat setzt für `.txt` keinen Content-Type, Material erzwingt `attachment`; `nosniff` und CSP `script-src 'none'` sind gesetzt. Restrisiko: Download-Dateien mit fremdem Inhalt im Namen der Gemeinde.
- **Empfehlung:** Für Textdateien Größe begrenzen und auf UTF-8/keine `<script`-Signaturen prüfen; Content-Type beim Ausliefern immer `text/plain; charset=utf-8` erzwingen.

### BF-21: Teamer:innen erzeugen weiterhin QR-Check-in-Tokens (Rest von Befund #13)
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/events/checkin.js:276` (`requireTeamer`), `:310` (`attendance-count`, `requireTeamer`)
- **Kennzeichnung:** reproduziert — als `teamer1`: `POST /api/events/1/generate-qr` → **200**; dagegen `POST/PUT/DELETE /events`, `cancel`, `participants`, `attendance`, `series` → 403.
- **Beschreibung:** Simons Entscheidung vom 16.09.2026 („Teamer:innen verwalten Termine nicht") ist für sieben Aktionen umgesetzt. Ob QR-Erzeugung und Live-Zähler gewollt bleiben (Teamer:in führt den Check-in vor Ort), ist nicht dokumentiert.
- **Empfehlung:** Entscheiden und im Handbuch festhalten; bei „nein" `requireAdmin`.

### BF-22: Absturzdiagnose ohne Einwilligungs- oder Abschaltmöglichkeit
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/services/absturzdiagnose.ts:46-54` und `:246-252` (`diagnoseSchalten` existiert, „eine solche Oberfläche gibt es heute nicht"), kein Aufrufer außerhalb der Datei
- **Kennzeichnung:** aus Code gelesen; Datenumfang geprüft: Rolle (normalisiert), Organisations-ID, Plattform, App-Fassung, gekürzte Fehlermeldungen (200 Zeichen) — keine Nutzer-ID, keine Namen. `datenschutz.html` nennt Crashlytics (4 Treffer).
- **Beschreibung:** Daten gehen an Google (Crashlytics) ohne Opt-out in der App. Für Minderjährige ist das nach DSGVO-Maßstab mindestens erklärungsbedürftig; die Datensparsamkeit selbst ist vorbildlich umgesetzt.
- **Empfehlung:** Schalter im Profil, der `diagnoseSchalten(false)` ruft; Hinweis beim ersten Start.

## Unklar

- **Werden Chat-Nachrichtentexte im Push-Payload an FCM/APNs übertragen?** `pushService.js:763/961` senden `notification.body`; welche Stelle Chat-Nachrichten befüllt, wurde nicht bis zum Ende verfolgt (Push-Bereich). Falls ja, liegen Chat-Inhalte Minderjähriger auf Google-/Apple-Servern — die Datenschutzerklärung nennt Push (7 Treffer), aber nicht, was drinsteht.
- **Zeigt `X-Real-IP` in Produktion wirklich die Client-IP?** Die Limiter hängen daran (BF-05, BF-13). Nur mit Zugriff auf Apache-Konfiguration/Logs klärbar.
- **Enthält `notifications.data` (JSONB) Namen anderer Personen**, die nach deren Löschung stehen bleiben? Struktur nicht analysiert.
- **Existiert ein Datenexport (Art. 15 DSGVO)?** Keine Route gefunden (`grep export|Auskunft` in `konfi.js`/`auth.js` ohne Treffer); ob der Rückblick als Auskunft gilt, ist eine fachliche Frage.

## Alte Befunde nachgeprüft

- **N1 (API-Doku, 22.08.2026): `PUT /users/:id/reset-password` schützt `is_super_admin`-Ziele nicht** → **weiter offen**, sogar für Rolle `super_admin`; zusätzlich über `PUT /:id` und `DELETE /:id` (BF-01). `users.js:942-943` behauptet das Gegenteil.
- **N2 (22.08.2026): Passwortwechsel beendet Sitzungen nicht** → **behoben bestätigt**: alte Sitzung vor Wechsel 200, danach 401 (Test); Refresh-Tokens werden widerrufen (`auth.js:323-330`, `users.js:954-965`, `konfi-management.js:660-675`).
- **N3 (22.08.2026): keine eigenen Limiter auf `check-username`, `validate-invite`, `reset-password`, `refresh`** → **weiter offen** (`server.js`/`createApp.js` hängen dort keinen an; BF-18).
- **N5 (22.08.2026): Konfis sahen Org-Kontaktdaten** → **behoben bestätigt**: `GET /api/organizations/1` als Konfi → 403 (Test); `organizations.js:151,203,1288` mit `requireOrgVerwaltung`.
- **N6 (22.08.2026): schwache Passwortpolicy an Org-Routen** → **behoben bestätigt** für `POST /organizations` und `POST /:id/admins` per `passwortPolicy` (`organizations.js:39-43,51,73`); der Inline-Check `password.length < 6` in `:1046` ist tot, aber harmlos.
- **N7 (22.08.2026): Passwortpolicy beim Bearbeiten umgehbar** → **behoben bestätigt** (`users.js:318-329`).
- **offene-befunde.md #13 (16.09.2026): Teamer-Rechte an Terminen** → **weitgehend umgesetzt**: sieben Verwaltungsaktionen liefern 403; `generate-qr` und `attendance-count` bleiben offen (BF-21).
- **Kommentar `rbac.js:293-300` (10.09.2026): Org-Trennung läuft über die Abfragen** → **bestätigt** durch 150 Fremdzugriffe ohne Abfluss (siehe „Geprüft und in Ordnung").
- **Kommentar `server.js:80-87` (22.08.2026): Socket-Auth prüft Konto in der DB** → bestätigt aus Code (`is_active`, `deleted_at`, Soft-Revoke, aktive Org mit Mitgliedschaftsprüfung).
- **Kommentar `auth.js:698-703` (22.08.2026): Reset-Tokens gehasht** → bestätigt (`hashToken` beim Schreiben und Lesen, `auth.js:702,1131-1136`).

## Geprüft und in Ordnung

- **Mandantentrennung über alle Router:** 150 Fremdzugriffe (Konfi-Verwaltung, Jahrgänge, Aktivitäten, Anträge inkl. Fotos, Badges, Kategorien, Levels, Benutzer, Termine für Leitung/Team/Konfi, Buchungen, Anwesenheit, QR, Chat-Räume/-Nachrichten/-Dateien/-Umfragen/-Reaktionen/Direktchats, Material inkl. Dateien, Challenges inkl. Beiträgen/Dateien/Export, Zertifikate, Rückblick, Organisation, Postfach, Einladungen, Einladungscodes) → kein 2xx mit Fremddaten; Körper-übergreifende Referenzen (`jahrgang_ids`, `category_ids`, `event_ids`, `role_id`, `activity_id`, `konfi_id`, `user_id`, `participants`) werden abgewiesen. `X-Active-Organization: 2` ohne Mitgliedschaft → 403 (`rbac.js:150-166`). Methode: temporärer Test, drei Läufe, Positivkontrollen 11/11 grün.
- **Rollenhierarchie (außer BF-01):** `admin` kann keinen `org_admin`/`super_admin` anlegen, befördern, degradieren oder dessen Passwort setzen (403); `teamer` legt keine Benutzer an; `org_admin` kann keine `super_admin`-Rolle vergeben (`roleHierarchy.js:27-29`, Test 403). Massenzuweisung: `is_super_admin`/`organization_id` im Body werden ignoriert (`users.js:304-316`, DB geprüft); `is_active`/`trial_ends_at`/`max_konfis` sind für `org_admin` an `PUT /organizations/:id` wirkungslos (`organizations.js:689-716`, DB geprüft); `PATCH /:id/limit` nur Super-Admin.
- **Konfi → Teamer-Beförderung:** `requireAdmin` + `darfKonfi(edit)`, Rolle aus der eigenen Org, Buchungen/offene Anträge werden aufgeräumt (`konfi-management.js:1502-1600`).
- **JWT:** `jsonwebtoken 9.0.3` (kein `alg=none`, HMAC-only bei String-Secret — Test: `alg=none` → 401, fremder Schlüssel → 401); `JWT_SECRET` Pflicht in `server.js:16-20`, `rbac.js:3-6`, `auth.js:27-30`; Access 15 min, Refresh 90 Tage als SHA-256-Hash; Soft-Revoke über `token_invalidated_at` auch für gecachte Einträge (`rbac.js:102-113`); `QR_SECRET` Pflicht, QR-Token HS256, in `events.qr_token` hinterlegt und beim Check-in gegen die Zeile und die Org geprüft (`checkin.js:66-81`).
- **Passwörter:** bcrypt Kostenfaktor 10 an allen sieben Hash-Stellen; Policy 8+ Zeichen, Groß/Klein, Ziffer, Sonderzeichen, keine Leerzeichen (`passwordUtils.js:60-83`); Reset-Tokens 32 Byte zufällig, 24 h, gehasht, einmalig; neutrale Antwort ohne Konto-Enumeration (`auth.js:707-720`).
- **Docs-Anmeldung:** zeitkonstanter Vergleich, eigener 20/15-min-Limiter, Cookie `HttpOnly; Secure; SameSite=Lax`, Zweck-Claim trennt Docs-Cookie und Nutzer-Token (Test: beide Richtungen 401).
- **Socket.IO:** DB-Prüfung je Verbindung, Raumbeitritt nur nach `darfRaumBetreten` (Org, Teilnehmerschaft, Direktchat-Schutz auch für Leitung), Tipp-Anzeige ebenso (`server.js:88-208`, `chatRoomAccess.js`).
- **SQL:** Alle `${…}`-Interpolationen in SQL geprüft — ausschließlich Platzhalter-Nummern, Whitelist-Spalten (`getPointField`), feste Fragmente oder String-Literale aus den Routen (`orgOwnership.js:9-10`); kein Sortier-/Filterparameter aus `req.query` in SQL; LIKE-Muster nur mit `$1`-Bindung (`organizations.js:134`, `material.js:280`).
- **Uploads:** `diskStorage` unter `uploads/tmp` mit Zufallsnamen, Aufräumen bei `close`; Größen 5/20/50 MB mit 413; Magic-Bytes-Prüfung vor dem Ablegen an allen vier Stellen (Bilder nur `image/*`, Challenge-Medien nach erwartetem Präfix); Dateinamen `randomBytes(32)` als Hex, beim Ausliefern per `/^[a-f0-9]{64}$/` bzw. `basename` geprüft; Auslieferung nur an Raum-Teilnehmer (Chat), Berechtigte nach Rolle/Jahrgang/Sichtbarkeit (Challenges), `requireTeamer` + Org + Jahrgangsschranke (Material), Antragsfotos org- und jahrgangsgebunden (Test: fremde Fotos 404).
- **Verschlüsselung ruhender Medien:** AES-256-GCM, 12-Byte-Zufalls-IV je Datei, Tag geprüft, Schlüssel 32 Byte aus Umgebung erzwungen (`photoCrypto.js:24-36,47-53,98-134`); stromweise, 64 KiB im Speicher.
- **HTTP-Härtung:** kein `x-powered-by`; CSP `default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`; `X-Frame-Options: DENY`; `nosniff`; `Referrer-Policy: strict-origin-when-cross-origin` (Test); Fehlerhandler ohne Stacktrace nach außen; `/api/metrics*` nur Super-Admin (ohne Token 401, `org_admin` 403).
- **Löschkonzept (Selbstlöschung):** Konfi mit Zeilen in 15 Tabellen (Push-Token, Refresh-Token, Reset, Postfach, Chat, Buchung, Antrag, Badge, Challenge-Beitrag, Rückblick, Abmeldung, Einladung, Zertifikat) → `POST /api/auth/delete-account` 200, danach **0 Zeilen** in allen 24 `user_id`/`konfi_id`-Spalten, `users`-Zeile weg; Dateien werden nach COMMIT gelöscht (`konfiDeletion.js`). Alle 11 `NO ACTION`-Fremdschlüssel auf `users(id)` werden in `konfiDeletion.js:139-159` und `users.js:461-492` anonymisiert oder gelöscht; die übrigen 30 sind `CASCADE`/`SET NULL` (aus `audit_schema`).
- **Aufbewahrung:** Konfis 60 Tage nach Konfirmation soft, 120 Tage hart gelöscht (`backgroundService.js:1288-1521`), Postfach 365 Tage, Push-Tokens 30 Tage inaktiv, APM 2 Jahre, Refresh-Tokens täglich.
- **Analytics/Absturzdiagnose:** keine Nutzer-ID, kein Name, keine Org (Umami), Org nur als Zahl (Crashlytics), Rolle normalisiert, Positivlisten für Ereigniswerte (`analytics.ts:139-200`), Meldungen auf 200 Zeichen gekürzt.
- **Tageslosung:** Abruf serverseitig mit API-Key und Übersetzung, keine Nutzerdaten (`losungService.js:90-115`).
- **Abhängigkeiten:** `npm audit` im Backend: 0 Meldungen (info/low/moderate/high/critical je 0). Versionen: express 5.2.1, helmet 8.3.0, jsonwebtoken 9.0.3, multer 2.3.0, file-type 22.0.2, bcrypt 6.0.0, express-rate-limit 8.7.0, socket.io 4.8.3, nodemailer 9.1.1, firebase-admin 14.3.0.
- **Geheimnisse im Arbeitsbaum:** keine Tokens, keine `.env`, keine Keystores; `frontend/config/GoogleService-Info.plist` und `google-services.json` enthalten nur Client-Konfiguration (API-Key, App-ID, Project-ID — laut Google für Clients bestimmt).

## Nicht geprüft

- Verhalten der Rate-Limiter hinter Apache/Traefik (nur Code und Kommentare).
- Socket.IO mit echtem Client; Live-Update-Adressierung (`liveUpdate.js`) auf Org-Grenzen.
- `routes/wrapped.js` (3313 Zeilen) über die getesteten Routen hinaus.
- Inhalte der Push-Payloads (Chat-Text an FCM/APNs) — siehe „Unklar".
- Frontend-Token-Speicherung (Keychain/Preferences) und Biometrie-Login: **kein Backend-Endpunkt gefunden** (`grep -i biometr backend/routes` ohne Treffer) — der Biometrie-Login ist offenbar reine Client-Logik über das gespeicherte Refresh-Token; damit gelten BF-08 und BF-15 für den Gerätespeicher.
- `docs/api/*.yaml` auf Vollständigkeit der Berechtigungsangaben.

## Auf Produktion nachzumessen

1. **Klartextpasswörter (BF-06):** `SELECT COUNT(*) FROM konfi_profiles WHERE password_plain IS NOT NULL;` — bei > 0 sofort `UPDATE konfi_profiles SET password_plain = NULL;` und Backups bewerten.
2. **Apple-Schlüssel (BF-02):** Im Apple-Developer-Portal prüfen, ob die Key-IDs `7AQA623H3T` und `A29U7SN796` widerrufen sind.
3. **Super-Admin-Exposition (BF-01):** `SELECT u.id, u.username, u.organization_id, r.name, u.is_super_admin FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin' OR u.is_super_admin;` — jede Zeile mit gesetzter `organization_id` ist von jedem `org_admin` dieser Org übernehmbar. Dazu `SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='org_admin' AND u.organization_id IN (…)`.
4. **Reset-Limiter (BF-05) / X-Real-IP (BF-13):** In den Backend-Logs prüfen, ob `req.ip` bei Anfragen verschiedener Clients unterschiedlich ist (z. B. temporär `console.log(req.ip, req.headers['x-real-ip'], req.headers['x-forwarded-for'])`), und ob Apache `X-Real-IP` *überschreibt* (`RequestHeader set X-Real-IP %{REMOTE_ADDR}s`) oder nur setzt, wenn leer.
5. **Soft-gelöschte, aber aktive Konfis (BF-07):** `SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL AND last_login_at > deleted_at;`
6. **Nie geänderte Einmalpasswörter (BF-04):** nicht direkt messbar (nur Hash). Näherung: `SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='konfi' AND u.updated_at = u.created_at;` (wenn `updated_at` beim Passwortwechsel gesetzt wird — `auth.js:324` setzt es **nicht**, dann ist die Zahl eine Untergrenze).
7. **Unverschlüsselte Altdateien:** `for f in /opt/Konfi-Quest/uploads/{requests,chat,material,challenges}/*; do head -c 8 "$f" | grep -q KQPHOTO1 || echo "$f"; done | wc -l`
8. **Waisen in `uploads/challenges/` (BF-19):** Dateinamen im Verzeichnis gegen `SELECT file_path FROM challenge_submissions` abgleichen.
9. **Refresh-Token-Bestand (BF-08):** `SELECT user_id, COUNT(*) FROM refresh_tokens WHERE revoked_at IS NULL GROUP BY user_id ORDER BY 2 DESC LIMIT 20;`
10. **JWT_SECRET-Länge:** im Portainer-Stack prüfen (`echo -n "$JWT_SECRET" | wc -c` ≥ 32 Byte); der Code erzwingt nur „nicht leer".
11. **SMTP-Zertifikat (BF-09):** `openssl s_client -connect <SMTP_HOST>:465 -servername <SMTP_HOST> </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates` — ist es gültig, kann `rejectUnauthorized: false` einfach weg.
