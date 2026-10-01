# 03 — Nach dem Deploy

Erst wenn [02](02-portainer-stack.md) Schritt 4 grün ist.

## 1. Stimmt der Stand?

- [x] `GET /api/status` über die öffentliche Adresse, mehrfach (zwei Backends):
      `version` = App-Version aus `frontend/version.json`, `commit` = SHA des
      Deploys, Datenbank ok, keine übersprungene Migration.
      **Ergebnis 01.10.2026:** vier Abfragen um 00:21, beide Backends
      (`cron_leader` abwechselnd `true`/`false`): `version` 2.3.0, `commit`
      `e6a3d389` (= `main`, Merge #200), `database` ok, `migrations` ok,
      Migrationen gesamt 108, neu 0, fehlgeschlagen 0; Laufzeit 31.966 s. Um
      00:45 meldete dasselbe `commit` 278 s Laufzeit — ein paralleler Deploy
      desselben Stands, die Metrik-Messung unten lag davor.
- [x] Letzte Einträge in `schema_migrations`: bis `168_challenge_lesestand_leitung.sql`.
      Anzahl der Einträge = Anzahl der `.sql`-Dateien in `backend/migrations/`.
      `Migration FAILED` im Log: 0.
      **Ergebnis 01.10.2026:** Der Stand ist über 168 hinaus: 108 Einträge =
      108 `.sql`-Dateien, jüngster `185_push_tokens_app_symbol_weg.sql`
      (eingespielt 29.09.2026 21:01, davor 178, 177). `Migration FAILED`: 0
      in beiden Backends (Logs seit dem Start am 30.09. 15:28).
- [x] `password_plain`: jetzt 0 (Vorher-Wert aus [01](01-vor-dem-deploy.md)).
      **Ergebnis 01.10.2026:** 0 von 135 (vorher 0 von 130).
- [ ] Eine Mail auslösen (Passwort vergessen, Testkonto): Absender, Zustellung, Dauer.
      **Stand 01.10.2026:** nicht ausgelöst — der Auftrag lautete „nur
      messen, Produktionsdaten nicht ändern", und die Anfrage legt ein
      Reset-Token an. Seit dem Deploy von 2.3.0 gab es keine
      Reset-Anfrage (Zugriffs-Log: letzte am 29.09. 18:10, vor dem Deploy),
      einen echten Versand also noch nicht. Braucht Simons Freigabe und ein
      Testkonto mit erreichbarer Adresse.

## 2. Nachher-Messungen

Aus „Auf Produktion nachzumessen" (`docs/audit/2026-09-26/00-gesamtabnahme.md`)
— jeweils mit dem Vorher-Wert aus [01](01-vor-dem-deploy.md) vergleichen, wo es
einen gibt:

- [x] Nr. 3, 4, 12, 13 erneut (Super-Admin-Konten, Direktchats > 2, soft-gelöschte aktive Konten, Refresh-Tokens).
      **Ergebnis 01.10.2026:** Nr. 3 unverändert 2 Konten (ID 41 Org 1,
      ID 56 Org 4, Rolle `org_admin` mit Merkmal `is_super_admin`) — der
      Deploy ändert daran nichts, geschützt sind sie seit BF-01 im Code.
      Nr. 4: kein Direktchat mit mehr als zwei Personen; die vier mit nur
      einer Person (Räume 98, 113, 150, 151) stehen weiter. Nr. 12: 0.
      Nr. 13: 1.271 offene Refresh-Tokens auf 133 Konten (vorher 1.232 auf
      129), davon 1.268 noch nicht abgelaufen; Top 20: 208, 192, 174, 142,
      81, 25, 20, 19, 18, 15, 14, 14, 10, 10, 8, 7, 7, 7, 7, 7 (vorher 189,
      182, 165, 137, …). Seit dem Deploy von 2.3.0 (29.09. 21:01 bis 01.10.
      00:25) 117 neue Tokens, 39 davon an ein Gerät gebunden, 61 noch
      offen; höchstens 8 offene neue je Konto. Bewertung: Die Gnadenfrist
      wirkt (Rotation widerruft), der Altbestand wächst aber weiter, weil
      jede Anmeldung ein Token anlegt und es keine Obergrenze je Konto gibt
      — Entscheidung bei Simon (Obergrenze oder Aufräumen der ungebundenen).
- [x] Nr. 5 nach der nächsten Nacht: Vortags-Erinnerungen kommen 24 h vor Beginn, nicht mehr gesammelt um 00:00.
      **Ergebnis 01.10.2026:** seit dem Deploy 25 Vortags-Erinnerungen an
      4 Termine, versandt 30.09. 15:43–16:58 für Beginne am 01.10.
      15:58–17:00 — 24,03 bis 24,24 h vorher; keine um 00:00 (vorher 145
      um 00:00). Behoben.
- [x] Nr. 8: `req.ip` gegen `X-Real-IP`/`X-Forwarded-For` — kommt die echte Client-IP im Backend an? (Wichtig für die Anmelde-Sperre nach Fehlversuchen.) Messweg ohne Code-Änderung und die nötige Proxy-Einstellung: [06](07-client-adresse-hinter-dem-proxy.md).
      **Ergebnis 01.10.2026:** Fall A — siehe [07](07-client-adresse-hinter-dem-proxy.md).
- [ ] Nr. 9: `docker stats` und CPU-Drosselung von Postgres an einem Abend, Cache-Trefferquote aus `pg_stat_database`, Größe der größten Tabellen.
      **Stand 01.10.2026 (00:28, nachts — der Abend steht aus):** Postgres
      1,3 % CPU, 167 MiB von 3 GiB; Backends 90 und 92 MiB von 512 MiB.
      CPU-Grenze 2 Kerne; seit dem Start (30.09. 15:28, 9 h) 15 von 48.467
      Perioden gedrosselt, zusammen 1,7 s (vorher 14.489-mal und 2.317 s in
      27 h bei 0,3 Kernen). Cache-Trefferquote 99,96 %. Datenbank 24 MB;
      größte Tabellen `apm_snapshots` 2,7 MB, `refresh_tokens` 2,1 MB,
      `notifications` 1,3 MB, `chat_messages` 448 kB, `event_bookings`
      440 kB. 34 Verbindungen, `shared_buffers` 768 MB, `work_mem` 8 MB,
      `statement_timeout` 0, `pg_stat_statements` geladen. Host: Last 2,4,
      Swap 5.698 von 8.191 MB (vorher 8.116).
- [x] Nr. 11: Zugriffs-Log des Proxys — Tokens in URLs von Chat-Dateien? Löschungen von Buchungen durch Konfi-Konten?
      **Ergebnis 01.10.2026:** Zugriffs-Log des vorderen Proxys über rund
      vier Wochen (fünf Dateien bis 01.10.): 347 Aufrufe von Chat-Dateien,
      **0** mit Token in der Adresse. Andere Token-Parameter: 16-mal
      `/reset-password?token=` (Link aus der Reset-Mail, gewollt; das Token
      steht damit im Zugriffs-Log) und 2-mal ein fremder Pfad ohne Bezug zur
      App. `DELETE /api/events/<id>/book` (Konfi-Weg): 1 Aufruf am 11.09.,
      vor dem Deploy, seitdem 0; wer ihn schickte, zeigt das Zugriffs-Log
      nicht. Dazu 4-mal der Leitungsweg `DELETE …/bookings/<id>`.
- [ ] Nr. 14: Dauer eines Push-Versands, Anteil „Keine Push-Tokens", Dauer und Push-Zahl des App-Icon-Zähler-Laufs.
      **Stand 01.10.2026:** Anteil ohne Token aus den Sammelzeilen seit
      30.09. 15:28: Vortags-/Stunden-Erinnerungen 15 von 17 Empfänger:innen
      (5/5, 5/6, 5/6), Challenge-Start meist 1–2 von 11, einmal 11 von 11
      und 11 von 12. **Nicht messbar ohne Code:** Dauer eines Versands und
      Dauer/Push-Zahl des Zähler-Laufs stehen in keiner Log-Zeile. Die
      stündliche Zeile „vorheriger Lauf noch aktiv — Zähler-Takt
      übersprungen" (backend2, jede Stunde um :28:24) ist kein hängender
      Lauf: Fünf-Minuten- und Stundentakt starten gleichzeitig und treffen
      sich jede zwölfte Runde.
- [ ] Mit `pg_stat_statements` nach einer Woche: die zehn Abfragen mit der
      größten Gesamtzeit und die zehn mit der größten Einzelzeit. Ergebnis
      als Tabelle (Abfrage gekürzt, Aufrufe, mittlere Zeit) — ohne Daten aus
      den Abfragen.
      **Stand 01.10.2026:** Zählung läuft seit 27.09. 16:26; die Woche ist
      am 04.10. voll.
- [x] Zusatz (Simon, 28.09.): Serverzeiten unter normaler Last gegen die
      Werte vor 2.3.0.
      **Ergebnis 01.10.2026:** `apm_snapshots` (Fünf-Minuten-Schnappschuss
      des Cron-Leaders, `worst_p95_ms` = schlechteste Route nach Serverzeit):
      22.–29.09. vor dem Deploy Median 1.064 ms, p90 1.475 ms (2.248
      Schnappschüsse; tagsüber 07–22 Uhr 1.026 ms, 1.413); nach dem Deploy
      Median 148 ms, p90 243 ms (327; tagsüber 148 ms, 189). Tagesmediane
      22.–26.09. 1.071–1.326 ms, 28.09. 336, 29.09. 263, 30.09. 148 ms.
      Je Route vorher (Median der Schnappschüsse, in denen sie die
      schlechteste war) → jetzt (`/api/metrics`, beide Backends,
      30.09. 15:28 bis 01.10. 00:30, 2.750 Anfragen, Serverzeit p95, in
      Klammern Stichproben): `GET /konfi/dashboard` 1.259 → 111 ms (76),
      `GET /konfi/events` 1.302 → 91 ms (141), `GET /konfi/profile` 1.312 →
      73 ms (83), `GET /challenges/files/:datei` 1.326 → 50 ms (366),
      `GET /konfi/badges` 966 → 131 ms (38, p95 = max), `GET
      /konfi/badges/v2` 1.064 → 164 ms (44, p95 = max). Bewertung: rund
      Faktor 8 schneller; der Deploy brachte zugleich den Code von 2.3.0
      und Postgres von 0,3 auf 2 Kerne (Drosselung oben) — welcher Anteil
      woher kommt, trennt die Messung nicht. Die Vorher-Werte sind p95 über
      200 Stichproben je Route auf einem Backend, die Nachher-Werte über
      38–366 auf beiden; bei p95 = max ist der Wert ein Einzelfall.

## 3. Log-Volumen (Betrieb BF-11)

Der Bericht rechnet vor, dass das Log bei Zielgröße die Aufbewahrung binnen
Stunden überrollt.

- [x] Log-Zeilen und Bytes pro Stunde je Backend an einem Abend messen,
      Aufbewahrung des Docker-Log-Treibers ablesen (`max-size`, `max-file`).
      Reicht die Aufbewahrung für mindestens 7 Tage? Wenn nicht: Vorschlag
      (Log-Rotation größer, Sammelzeilen statt Einzelzeilen im Code —
      Letzteres als Pull Request mit Test) und Simon fragen.
      **Ergebnis 01.10.2026:** json-file 10 MB × 3 = 30 MB je Container (am
      Container und als Vorgabe des Docker-Dienstes). 30.09. 15:28 bis 01.10.
      00:22: backend 128 Zeilen / 20,7 kB, backend2 179 Zeilen / 27,2 kB
      (Datei im json-Format). Abend 18–22 Uhr: im Mittel 2,3 kB/h (backend)
      und 2,6 kB/h (backend2), Spitze 4,8 kB/h. Heute reicht das für über
      ein Jahr. Bei Zielgröße (Faktor ~110, EKD-Ausrollung) wären es rund
      290 kB/h → 30 MB in etwa 4,4 Tagen, also **unter 7 Tagen**. Größte
      Quellen (backend2): `[PUSH] Registrierung` 71 von 179 Zeilen (40 %),
      `Socket.io … connection_error: Bad request` 37 (21 %). Vorschlag:
      `max-size` 50m × `max-file` 5 (250 MB je Container, bei Zielgröße rund
      36 Tage; Plattenplatz vorher prüfen) und/oder die
      Registrierungszeile auf Neuanlagen beschränken. **Simon entscheidet.**

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

- [x] Die Umami-Datenbank sichern (wie in [01](01-vor-dem-deploy.md),
      Punkt 1). Diese Sicherung enthält die Namen noch: nach der geprüften
      Bereinigung verwerfen, nicht in den regulären Sicherungsbestand
      übernehmen.
      **Ergebnis 01.10.2026:** gesichert (Dump 10,5 MB, 27 Tabellen lesbar),
      nach der geprüften Bereinigung gelöscht; nie im Sicherungsbestand.
- [x] Die erlaubten Werte aus dem **deployten** Stand erzeugen (Repo-Wurzel):
      ```
      node frontend/scripts/fehlerstellen-sql.mjs > erlaubte_stelle.sql
      ```
      Das legt eine temporäre Tabelle `erlaubte_stelle(wert)` an. Alles
      Folgende in **derselben** psql-Sitzung, die Datei dort mit
      `\i erlaubte_stelle.sql` einlesen. Die letzte Zeile nennt die Zahl der
      Werte (Stand 27.09.2026: 223 — 203 Texte der App, 19 Server-Texte der
      Event-An- und -Abmeldung, `andere-meldung`).
      **Ergebnis 01.10.2026:** aus dem live laufenden Stand `e6a3d389`
      erzeugt: 229 Werte.
- [x] Spalten prüfen: `\d event_data` und `\d website_event`. Erwartet
      (Umami 2.x und 3.x): `event_data.website_event_id`, `data_key`,
      `string_value`; `website_event.event_id`, `website_id`, `event_name`,
      `created_at`. Weicht etwas ab, die Abfragen anpassen, nicht raten.
      **Ergebnis 01.10.2026:** alle Spalten wie erwartet.
- [x] Zählen (Lese-Abfrage). Ins Ergebnis nur die Zahlen, **keine Werte**:
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
      **Ergebnis 01.10.2026:** 31 Einträge, 14 verschiedene Werte, erster
      11.08.2026, letzter 28.09.2026; seit dem Deploy von 2.3.0: 0. Alle
      `stelle`-Einträge der App zusammen: 160.
- [x] Die Werte durch den Platzhalter ersetzen. So bleiben die Zahl der
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
      **Ergebnis 01.10.2026:** `UPDATE 31` = Zählung; die Sitzung verglich
      die Zahl vor dem `COMMIT` selbst und hätte sonst zurückgerollt.
- [x] Zählung wiederholen: `eintraege` = 0.
      **Ergebnis 01.10.2026:** 0; `stelle`-Einträge weiter 160.
- [ ] Wiederholen, solange Store-Fassungen ohne die Korrektur im Umlauf sind
      — monatlich, jedes Mal mit einer frisch erzeugten Liste (sie wächst mit
      neuen Meldungen der App). Die Zählung zeigt, ob noch Werte außerhalb der
      Liste ankommen; seit dem Deploy können sie nur von alten Fassungen
      stammen.
      **Stand 01.10.2026:** erster Lauf erledigt (oben); nächster Anfang
      November.
- [ ] Absturzberichte (Firebase Crashlytics, nur iOS und Android): Die
      Wegmarken vor einem Absturz trugen denselben Text
      (`fehler <ort> <art>: <Text>`). In der Firebase-Konsole nachsehen, ob
      Berichte mit solchen Zeilen vorliegen. Ob sie sich einzeln löschen
      lassen, am Konto prüfen; sonst verfallen sie nach 90 Tagen
      (Datenschutzerklärung 9b). Ergebnis an Simon.
      **Stand 01.10.2026:** nicht geprüft — die Firebase-Konsole braucht
      Simons Anmeldung; liegt bei Simon.

### B4 — Wie lange eine Sitzung lebt und was Umami zum Ort speichert

`frontend/src/services/analytics.ts` spricht von einem „täglich wechselnden
Hash", die Datenschutzerklärung (9a) nennt nur das „Herkunftsland" und
schließt eine Wiedererkennung aus. Im Umami-Quelltext (Hauptzweig, Fassung
3.4.0, nachgesehen am 27.09.2026) wechselt das Salz der Sitzungskennung ohne
Einstellung aber **monatlich** (`SALT_ROTATION`, Vorgabe `month`, möglich
`day` und `week`), und zur Sitzung werden `country`, `region` und `city`
gespeichert.

- [x] Laufende Umami-Fassung ablesen (Image-Tag des Containers) und im
      Quelltext genau dieser Fassung nachsehen, ob sie `SALT_ROTATION` kennt
      (`src/app/api/send/route.ts`, `src/lib/crypto.ts`).
      **Ergebnis 01.10.2026:** Image-Tag 3.4.0; im Tag `v3.4.0` liest
      `src/app/api/send/route.ts` `SALT_ROTATION` (Vorgabe `month`), `getSalt`
      in `src/lib/crypto.ts` kennt `day`, `week`, sonst Monat.
- [x] In der Umgebung des Umami-Containers: Ist `SALT_ROTATION` gesetzt, mit
      welchem Wert?
      **Ergebnis 01.10.2026:** nicht gesetzt — das Salz wechselt monatlich.
- [x] Region und Stadt zählen (Lese-Abfrage; Spaltennamen vorher mit
      `\d session` prüfen, ältere Fassungen heißen anders):
      ```sql
      SELECT count(*)                                  AS sitzungen,
             count(*) FILTER (WHERE region IS NOT NULL) AS mit_region,
             count(*) FILTER (WHERE city   IS NOT NULL) AS mit_stadt
        FROM session
       WHERE website_id = '<APP_WEBSITE_ID>';
      ```
      **Ergebnis 01.10.2026:** 3.185 Sitzungen der App seit 11.08.2026,
      3.113 mit Region (97,7 %), 3.011 mit Stadt (94,5 %).
- [ ] Mit der Datenschutzerklärung (Abschnitt 9a) abgleichen und Simon mit
      den Zahlen vorlegen: entweder `SALT_ROTATION=day` setzen (wenn die
      Fassung es kennt) und die Ortsangaben auf das Land beschränken — oder
      den Kommentar in `analytics.ts` und die Datenschutzerklärung
      richtigstellen (Sitzung bis zu einem Monat, Region und Stadt). Nichts
      davon ohne Simons Entscheidung ändern.
      **Stand 01.10.2026:** vorgelegt, nichts geändert. Die
      Datenschutzerklärung (9a) nennt nur das Land; gespeichert werden
      Region und Stadt, eine Sitzung hält bis zu einem Monat. **Simon
      entscheidet:** `SALT_ROTATION=day` (die Fassung kennt es) und
      Ortsangaben beschränken — oder Kommentar und Datenschutzerklärung
      richtigstellen.
