# 03 — Nach dem Deploy

Erst wenn [02](02-portainer-stack.md) Schritt 4 grün ist.

## 1. Stimmt der Stand?

- [ ] `GET /api/status` über die öffentliche Adresse, mehrfach (zwei Backends):
      `version` = App-Version aus `frontend/version.json`, `commit` = SHA des
      Deploys, Datenbank ok, keine übersprungene Migration.
- [ ] Letzte Einträge in `schema_migrations`: bis `168_challenge_lesestand_leitung.sql`.
      Anzahl der Einträge = Anzahl der `.sql`-Dateien in `backend/migrations/`.
      `Migration FAILED` im Log: 0.
- [ ] `password_plain`: jetzt 0 (Vorher-Wert aus [01](01-vor-dem-deploy.md)).
- [ ] Eine Mail auslösen (Passwort vergessen, Testkonto): Absender, Zustellung, Dauer.

## 2. Nachher-Messungen

Aus „Auf Produktion nachzumessen" (`docs/audit/2026-09-26/00-gesamtabnahme.md`)
— jeweils mit dem Vorher-Wert aus [01](01-vor-dem-deploy.md) vergleichen, wo es
einen gibt:

- [ ] Nr. 3, 4, 12, 13 erneut (Super-Admin-Konten, Direktchats > 2, soft-gelöschte aktive Konten, Refresh-Tokens).
- [ ] Nr. 5 nach der nächsten Nacht: Vortags-Erinnerungen kommen 24 h vor Beginn, nicht mehr gesammelt um 00:00.
- [ ] Nr. 8: `req.ip` gegen `X-Real-IP`/`X-Forwarded-For` — kommt die echte Client-IP im Backend an? (Wichtig für die Anmelde-Sperre nach Fehlversuchen.)
- [ ] Nr. 9: `docker stats` und CPU-Drosselung von Postgres an einem Abend, Cache-Trefferquote aus `pg_stat_database`, Größe der größten Tabellen.
- [ ] Nr. 11: Zugriffs-Log des Proxys — Tokens in URLs von Chat-Dateien? Löschungen von Buchungen durch Konfi-Konten?
- [ ] Nr. 14: Dauer eines Push-Versands, Anteil „Keine Push-Tokens", Dauer und Push-Zahl des App-Icon-Zähler-Laufs.
- [ ] Mit `pg_stat_statements` nach einer Woche: die zehn Abfragen mit der
      größten Gesamtzeit und die zehn mit der größten Einzelzeit. Ergebnis
      als Tabelle (Abfrage gekürzt, Aufrufe, mittlere Zeit) — ohne Daten aus
      den Abfragen.

## 3. Log-Volumen (Betrieb BF-11)

Der Bericht rechnet vor, dass das Log bei Zielgröße die Aufbewahrung binnen
Stunden überrollt.

- [ ] Log-Zeilen und Bytes pro Stunde je Backend an einem Abend messen,
      Aufbewahrung des Docker-Log-Treibers ablesen (`max-size`, `max-file`).
      Reicht die Aufbewahrung für mindestens 7 Tage? Wenn nicht: Vorschlag
      (Log-Rotation größer, Sammelzeilen statt Einzelzeilen im Code —
      Letzteres als Pull Request mit Test) und Simon fragen.

## 4. Screenshots neu ziehen (Gesamtabnahme Punkt 22, UI BF-09)

Die 42 Bilder unter `docs/screenshots/` zeigen den Stand vom 10.09. Sie
dienen als Handbuch-Bilder und als Store-Bilder für 2.3.0.

- [ ] Erst **nach** dem Deploy ziehen — sonst zeigen sie den alten Stand
      (CLAUDE.md, „Screenshots").
- [ ] `scripts/screenshots.mjs` gegen Produktion mit den Testkonten der
      Demo-Gemeinde. Android-Bilder **mit Android-Kennung** (sonst entstehen
      sie im iOS-Look).
- [ ] **Jedes Bild ansehen.** Keine 404-Seite, kein Ladezustand, kein
      Anmeldefehler, keine echten Namen aus anderen Gemeinden. MD5 über alle:
      keine Dubletten.
- [ ] `npm --prefix frontend run docs:handbuch` (spiegelt die Bilder nach
      `frontend/public/docs/bilder/`), dann `git status` — die gespiegelten
      Bilder gehören in denselben Commit. `frontend/public/sitemap.xml` nicht
      mit einchecken.
- [ ] Die unreferenzierten Bilder im Handbuch-Spiegel (Sammelbefund S-17, 27
      Stück laut Bericht) nachzählen und entfernen, wenn wirklich nichts auf
      sie verweist.

## 5. Am Gerät (für Simon vorbereiten)

Diese Punkte braucht ein echtes Telefon. Als kurze Liste für Simon ins
Ergebnis schreiben, mit dem, was er jeweils ansehen soll:

- Flugmodus: Meldet die App „offline", und was passiert mit einer Abmeldung
  von einem Event im Funkloch?
- VoiceOver (iOS) und TalkBack (Android) auf der Anmeldeseite und im Chat.
- Systemschrift auf „Größt": Wächst die App mit?
