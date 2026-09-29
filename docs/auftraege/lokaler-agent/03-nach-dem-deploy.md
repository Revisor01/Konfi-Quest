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
- [ ] Nr. 8: `req.ip` gegen `X-Real-IP`/`X-Forwarded-For` — kommt die echte Client-IP im Backend an? (Wichtig für die Anmelde-Sperre nach Fehlversuchen.) Messweg ohne Code-Änderung und die nötige Proxy-Einstellung: [06](07-client-adresse-hinter-dem-proxy.md).
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
Welche Bilder was zeigen müssen und woran man ein gelungenes Bild erkennt,
steht ausführlich in [08](08-screenshots-2.3.md).

- [ ] Erst **nach** dem Deploy ziehen — sonst zeigen sie den alten Stand
      (CLAUDE.md, „Screenshots").
- [ ] `scripts/screenshots.mjs` gegen Produktion mit den Testkonten der
      Demo-Gemeinde. Android-Bilder **mit Android-Kennung** (sonst entstehen
      sie im iOS-Look).
- [ ] **Jedes Bild ansehen.** Keine 404-Seite, kein Ladezustand, kein
      Anmeldefehler, keine echten Namen aus anderen Gemeinden. MD5 über alle:
      keine Dubletten.
- [ ] `npm --prefix frontend run docs:handbuch` (legt die im Handbuch
      eingebundenen Bilder als WebP unter `frontend/public/docs/bilder/` ab
      und schreibt `stand.json`; zum Kodieren braucht er Playwright mit
      Chromium wie `screenshots.mjs`), dann `git status` — WebP-Dateien und
      `stand.json` gehören in denselben Commit. `frontend/public/sitemap.xml`
      nicht mit einchecken.
- [x] Die unreferenzierten Bilder im Handbuch-Spiegel (Sammelbefund S-17):
      erledigt 29.09.2026 — der Generator legt nur noch ab, was ein Kapitel
      einbindet, und räumt den Rest weg (Doku-Audit BF-18).

## 5. Am Gerät (für Simon vorbereiten)

Diese Punkte braucht ein echtes Telefon. Als kurze Liste für Simon ins
Ergebnis schreiben, mit dem, was er jeweils ansehen soll:

- Flugmodus: Meldet die App „offline", und was passiert mit einer Abmeldung
  von einem Event im Funkloch?
- VoiceOver (iOS) und TalkBack (Android) auf der Anmeldeseite und im Chat.
- Systemschrift auf „Größt": Wächst die App mit?

## 6. Umami bereinigen (Messung B1 und B4)

Befunde aus [docs/messung/umami.md](../../messung/umami.md). Adresse, Zugang
und Container der Umami-Instanz stehen in der Betriebsdoku, nicht hier.
`<APP_WEBSITE_ID>` ist `WEBSITE_ID` aus `frontend/src/services/analytics.ts`
— die Kennung der **App**, nicht die der Startseite.

Dieser Abschnitt ändert ausdrücklich Produktionsdaten (Regel „Nichts an
Produktionsdaten ändern" im [README](README.md)): Er entfernt
personenbezogene Daten, die nie hätten gespeichert werden dürfen.

### B1 — Namen aus `fehler.stelle` entfernen

Bis zu diesem Deploy schickte die App den angezeigten Fehlertext als Merkmal
`stelle` des Ereignisses `fehler` — auch Texte des Servers mit Namen („…
gehört zu keinem Jahrgang dieses Events", „… arbeitet bereits in dieser
Gemeinde.", „Für … steht bereits eine Einladung offen."), Dateinamen
(„Dateityp nicht verifizierbar: …") und Namen von Konfirmationsterminen.
Seitdem geht nur ein Wert aus einer festen Liste raus
(`frontend/src/utils/bekannteFehlertexte.ts`, Ziffern als `#`, höchstens 80
Zeichen) oder `andere-meldung`. Jeder andere Wert ist Altbestand — oder kommt
von einer App-Fassung ohne die Korrektur (Store-Apps bis zu ihrem Update).

- [ ] Die Umami-Datenbank sichern (wie in [01](01-vor-dem-deploy.md),
      Punkt 1). Diese Sicherung enthält die Namen noch: nach der geprüften
      Bereinigung verwerfen, nicht in den regulären Sicherungsbestand
      übernehmen.
- [ ] Die erlaubten Werte aus dem **deployten** Stand erzeugen (Repo-Wurzel):
      ```
      node frontend/scripts/fehlerstellen-sql.mjs > erlaubte_stelle.sql
      ```
      Das legt eine temporäre Tabelle `erlaubte_stelle(wert)` an. Alles
      Folgende in **derselben** psql-Sitzung, die Datei dort mit
      `\i erlaubte_stelle.sql` einlesen. Die letzte Zeile nennt die Zahl der
      Werte (Stand 27.09.2026: 223 — 203 Texte der App, 19 Server-Texte der
      Event-An- und -Abmeldung, `andere-meldung`).
- [ ] Spalten prüfen: `\d event_data` und `\d website_event`. Erwartet
      (Umami 2.x und 3.x): `event_data.website_event_id`, `data_key`,
      `string_value`; `website_event.event_id`, `website_id`, `event_name`,
      `created_at`. Weicht etwas ab, die Abfragen anpassen, nicht raten.
- [ ] Zählen (Lese-Abfrage). Ins Ergebnis nur die Zahlen, **keine Werte**:
      ```sql
      SELECT count(*)                       AS eintraege,
             count(DISTINCT d.string_value) AS verschiedene_werte,
             min(e.created_at)              AS erster,
             max(e.created_at)              AS letzter
        FROM event_data d
        JOIN website_event e ON e.event_id = d.website_event_id
       WHERE e.website_id = '<APP_WEBSITE_ID>'
         AND e.event_name = 'fehler'
         AND d.data_key   = 'stelle'
         AND d.string_value NOT IN (SELECT wert FROM erlaubte_stelle);
      ```
- [ ] Die Werte durch den Platzhalter ersetzen. So bleiben die Zahl der
      Fehler-Ereignisse und ihre Merkmale `art` und `ort` erhalten, der Text
      ist weg — wie bei allem, was die App seit dem Deploy schickt:
      ```sql
      BEGIN;
      UPDATE event_data d
         SET string_value = 'andere-meldung'
        FROM website_event e
       WHERE e.event_id = d.website_event_id
         AND e.website_id = '<APP_WEBSITE_ID>'
         AND e.event_name = 'fehler'
         AND d.data_key   = 'stelle'
         AND d.string_value NOT IN (SELECT wert FROM erlaubte_stelle);
      -- Ausgabe „UPDATE n": n muss „eintraege" aus der Zählung sein,
      -- sonst ROLLBACK;
      COMMIT;
      ```
      Soll der Eintrag stattdessen ganz verschwinden: `DELETE FROM
      event_data d USING website_event e WHERE …` mit derselben Bedingung —
      nur nach Rücksprache mit Simon.
- [ ] Zählung wiederholen: `eintraege` = 0.
- [ ] Wiederholen, solange Store-Fassungen ohne die Korrektur im Umlauf sind
      — monatlich, jedes Mal mit einer frisch erzeugten Liste (sie wächst mit
      neuen Meldungen der App). Die Zählung zeigt, ob noch Werte außerhalb der
      Liste ankommen; seit dem Deploy können sie nur von alten Fassungen
      stammen.
- [ ] Absturzberichte (Firebase Crashlytics, nur iOS und Android): Die
      Wegmarken vor einem Absturz trugen denselben Text
      (`fehler <ort> <art>: <Text>`). In der Firebase-Konsole nachsehen, ob
      Berichte mit solchen Zeilen vorliegen. Ob sie sich einzeln löschen
      lassen, am Konto prüfen; sonst verfallen sie nach 90 Tagen
      (Datenschutzerklärung 9b). Ergebnis an Simon.

### B4 — Wie lange eine Sitzung lebt und was Umami zum Ort speichert

`frontend/src/services/analytics.ts` spricht von einem „täglich wechselnden
Hash", die Datenschutzerklärung (9a) nennt nur das „Herkunftsland" und
schließt eine Wiedererkennung aus. Im Umami-Quelltext (Hauptzweig, Fassung
3.4.0, nachgesehen am 27.09.2026) wechselt das Salz der Sitzungskennung ohne
Einstellung aber **monatlich** (`SALT_ROTATION`, Vorgabe `month`, möglich
`day` und `week`), und zur Sitzung werden `country`, `region` und `city`
gespeichert.

- [ ] Laufende Umami-Fassung ablesen (Image-Tag des Containers) und im
      Quelltext genau dieser Fassung nachsehen, ob sie `SALT_ROTATION` kennt
      (`src/app/api/send/route.ts`, `src/lib/crypto.ts`).
- [ ] In der Umgebung des Umami-Containers: Ist `SALT_ROTATION` gesetzt, mit
      welchem Wert?
- [ ] Region und Stadt zählen (Lese-Abfrage; Spaltennamen vorher mit
      `\d session` prüfen, ältere Fassungen heißen anders):
      ```sql
      SELECT count(*)                                  AS sitzungen,
             count(*) FILTER (WHERE region IS NOT NULL) AS mit_region,
             count(*) FILTER (WHERE city   IS NOT NULL) AS mit_stadt
        FROM session
       WHERE website_id = '<APP_WEBSITE_ID>';
      ```
- [ ] Mit der Datenschutzerklärung (Abschnitt 9a) abgleichen und Simon mit
      den Zahlen vorlegen: entweder `SALT_ROTATION=day` setzen (wenn die
      Fassung es kennt) und die Ortsangaben auf das Land beschränken — oder
      den Kommentar in `analytics.ts` und die Datenschutzerklärung
      richtigstellen (Sitzung bis zu einem Monat, Region und Stadt). Nichts
      davon ohne Simons Entscheidung ändern.
