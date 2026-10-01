# Aufträge für den lokalen Agenten

Übergabe vom 27.09.2026. Simon betreibt Konfi Quest selbst und gibt CI,
Portainer-Stack und Mail-Versand an einen lokalen Agenten ab, der Zugang zu
Server, Portainer, GitHub (auch Workflows) und Mail-Konto hat. Diese Dateien
sagen, **was** zu tun ist und woran man merkt, dass es stimmt. **Wo** etwas
liegt und **womit** man sich anmeldet, steht nicht hier — dieses Repo ist
öffentlich.

**Einstieg: [00-ablauf-release-2.3.0.md](00-ablauf-release-2.3.0.md)** —
Reihenfolge von Sicherung bis Testbuild. Ein Merge nach `main` ist der
Produktions-Deploy; den Merge gibt Simon frei.

## Rückmeldung des lokalen Agenten, 01.10.2026

Alle Punkte 1–10 aus „Stand 30.09.2026" (unten) sind abgearbeitet; die
Ergebnisse stehen mit Datum und Messwert in den einzelnen Auftragsdateien.
`main` steht auf `688d0959` und ist live (`/api/status`: database, migrations,
cron_leader ok; 109 Migrationen, keine fehlgeschlagen). Gemergt: #203–#209.

### Erledigt (mit Messwert)

- **Push nach dem Paket-Update:** 0 Fehlerzeilen in beiden Backends, 0 neue
  Token-Fehler bei 132 Tokens; Zustellung belegt (Token 0,3 s nach der
  Mitteilung als erreichbar markiert). Weniger Mitteilungen als am Vortag lag
  am Betrieb (Nachbeantragung in einer Gemeinde am 29.09.).
- **Deploy-Lücke (10):** Ursache war `pullImage: true` — Portainer erstellte
  bei jedem Update alle Dienste neu, auch Postgres (25 s ohne API). Jetzt:
  Images vorab ziehen, Update ohne Pull, nur geänderte Dienste werden neu
  erstellt. Postgres lief über die Deploys vom 01.10. ohne Neustart durch.
  Postgres per Digest festgehalten.
- **Backend-Container (09):** Healthcheck ohne curl; Backends laufen ohne
  root als eigene uid `10001` (am Host unbelegt — uid 1000 gehört dort einem
  bestehenden Systemnutzer). Uploads und Push-Schlüssel sind für andere
  Nutzer am Host gesperrt. Ob die uid fest ins Image kommt, frühestens
  08.10.2026 (eine Woche ohne `EACCES`).
- **Stack (02):** genau ein Cron-Leader, Übernahme nach 0,2 s; Vortags-
  Erinnerung je Termin genau einmal (24,0–24,2 h vor Beginn).
- **Sicherung und Notfall (05):** nächtliche Sicherung jetzt im Format `-Fc`
  mit Lesbarkeitsprüfung (`pg_restore --list`, mindestens 50 Tabellen);
  Rückspielprobe 1,25 s, 0 Fehler; Notfall-Probelauf mit leerem Tag grün;
  Stand 2.2.0 läuft gegen die Datenbank von 2.3.0.
- **Datenbank (11):** Schema der Produktion gleich dem Repo (einzige Ausnahme
  `pg_stat_statements`, bewusst nur Betrieb); Postgres-Server fest auf UTC
  über die Befehlszeile; SMTP-Grenze 300/h und 1.000/Tag gilt jetzt für die
  tatsächliche Absenderadresse des Stacks.
- **Messungen (03, 06, 07, 04):** schlechteste Route im Median 1.259 → 211 ms;
  Client-Adresse kommt korrekt an; CSP 0 Verstöße auf 34 Seiten; Umami
  bereinigt.
- **Screenshots (08):** 42 Bilder neu, jedes angesehen.
- **Refresh-Tokens:** höchstens 10 je Konto, 1 je Gerät; Bestand 1.281 → 469.
- **Logs:** Push-Registrierung nur bei Änderung, Socket-Fehler gebündelt;
  hochgerechnet reicht die Aufbewahrung bei EKD-Größe ~11 statt 4,4 Tage.
- **App:** „noch 1 Punkt" (alle Stellen über `utils/punkteText.ts`);
  Selbstbezeichnung im Profil getrimmt; Eventdatum statt Verbuchungsdatum bei
  Event-Punkten (`event_date` additiv).

### Entschieden (Simon, 01.10.2026)

- Echter Notfall-Lauf entfällt, der Probelauf genügt.
- Rund 4 s Lücke der Web-App beim Frontend-Tausch sind in Ordnung, keine
  zweite Frontend-Instanz.
- Umami bleibt eingestellt wie es ist; Kommentar in `analytics.ts` und
  Datenschutzerklärung (9a) sind richtiggestellt (Sitzung je Kalendermonat,
  Ort bis zur Stadt).
- Das Mischkonto (Org-Leitung und Konfi in einer Testgemeinde) bleibt.
- „Kategorie-Meister 0 von 8" unter „Erreichte Badges" ist richtig so.
- Getrennte Kästen unter „Suche & Filter" auf Android bleiben.
- „Teamer" im Teamer-Profil ist die selbst gewählte Bezeichnung der Person,
  kein Fehler.
- `pg_stat_statements` wird keine Migration: Die Erweiterung braucht
  Superuser-Rechte und würde auf einer Instanz ohne sie (Notfall-Rückweg)
  jeden Deploy blockieren.

### Für den Agenten in der Cloud (nur Repo)

- [x] **Startbanner** — erledigt 01.10.2026 (PR #202): Das Banner zeigt
      „Deaktiviert (RUN_BACKGROUND_JOBS=false)" bzw. „Leader-Wahl (Jobs laufen
      auf dem Cron-Leader)"; `tests/utils/startbanner.test.js` startet
      `server.js` und liest die Zeile. Befund war: Das Backend meldete „Background: Gestartet", auch wenn
      `RUN_BACKGROUND_JOBS=false` gesetzt ist (gemessen am Test-Backend: die
      Zeile steht direkt unter „Hintergrund-Jobs DEAKTIVIERT").
- [x] **Handbuch** — erledigt 01.10.2026 (PR #202): Eintrag aus der
      Profil-Liste gestrichen; „Deine Stempel" ist der Abschnitt im
      Challenges-Reiter (so jetzt auch in `45-jahrgaenge.md`). Befund war:
      `docs/handbuch/20-teamer.md` beschrieb „Deine Stempel"
      im eigenen Profil; den Abschnitt gibt es dort laut Code seit dem
      14.09.2026 nicht mehr.
- [x] **Teamer-Startseite** — erledigt 01.10.2026 (Simon: angleichen): Unter
      dem Gruß steht die Selbstbezeichnung wie im Profil, sonst „Teamer:in"
      (`greeting.role_title`, additiv). Befund war: Unter dem Gruß stand fest
      „Teamer:in", im Profil die Selbstbezeichnung (`role_title`).
- [ ] **Datenschutzerklärung:** Abschnitt 9a und der Satz zur Obergrenze der
      Anmeldungen sind live (Stand 1. Oktober 2026); Simon liest gegen.
- [ ] **Testbuild:** Die App-Änderungen seit iOS 236 / Android 130 (Punkt-
      Plural, Selbstbezeichnung, Eventdatum) brauchen einen neuen Build —
      nur auf Simons Ansage.

### Neu aus der Cloud seit dieser Rückmeldung (PR #202, noch nicht gemergt)

PR #202 behebt drei Rückmeldungen aus dem Gerätetest 130/236 — Einzelheiten
in `docs/audit/2026-09-28/offene-punkte.md`, Abschnitt „Gerätetest Build
130/236". Zwei Dinge daraus gehen nur am Server oder am Gerät:

- [x] **Uploads vom Android-Handy nachzählen (lokaler Agent, 10 Minuten, nur
      Anzahlen):** PDF und Word gingen vom Android-Handy weder in den Chat
      noch ins Material. Die vermutete Ursache ist ein Abbruch im WebView,
      **bevor** die Anfrage den Server erreicht. Gegenprobe: in den
      Access-Logs des Proxys und den Logs beider Backends seit dem 28.09. die
      Antworten **413** und **415** auf `POST /api/chat/rooms/*/messages` und
      `POST /api/material/*/files` zählen, dazu die Zeilen `Datei abgelehnt`.
      Keine Dateinamen, keine Personen, nur Zahlen je Route und Status. Wenige
      oder keine Treffer bestätigen den Befund; viele 415 hießen, dass der
      Server PDFs ablehnt — dann sofort an Simon.
      **Ergebnis 01.10.2026:** Befund bestätigt. Proxy-Zugriffslog
      lückenlos vom 28.09. 00:00 bis 01.10. 16:35: 0 Antworten 413/415
      auf den Upload-Routen und 0 überhaupt; `POST
      /api/chat/rooms/*/messages` 53× 200, `POST /api/material/*/files`
      0 Anfragen (die Anfrage erreicht den Server nicht). Backend-Logs
      reichen wegen der Deploys nur bis 13:27 UTC zurück: 0 Zeilen
      „Datei abgelehnt". Nebenbei: `POST /api/chat/rooms/*/mark-read` 1×
      500 bei 718× 200.
- [ ] **Gerätetest der nächsten Builds (Simon):** eine PDF und eine Word-Datei
      vom Android-Handy in den Chat und ins Material (auch aus Google Drive und
      dem Download-Ordner); einen Chat mit mehreren liegenden Mitteilungen
      öffnen — sie verschwinden (auf Samsung und Xiaomi bleibt die eine mit
      der Zahl, solange noch etwas offen ist); auf dem iPhone die App über
      einen Chat-Push kalt starten — die übrigen Mitteilungen des Chats gehen
      ebenfalls. Die Mitteilungen auf Android brauchen den Server-Stand von
      PR #202 **und** den neuen Build.
- [x] **Vor dem Merge des PR nach #211: `backend-test` auf den neuen
      `test-latest` ziehen (lokaler Agent, 5 Minuten).** Der PR entfernt
      `konfi_profiles.password_plain` (Migration 187, Simon: „ja"). Das
      Test-Backend hängt an derselben Datenbank und meldet laut Übergabe
      Commit `674bd8e` vom 28.09.; dieser Stand setzt beim „Einmalpasswort
      erzeugen" die Spalte noch auf NULL und bekäme ohne sie eine 500.
      `test-backend.yml` ist am 01.10.2026 auf `main` angestoßen (baut nur das
      Image, rollt nichts aus). Danach: Image ziehen, `backend-test` neu
      erstellen, `/api/status` → `commit` ist der heutige `main`. Erst dann
      den PR mergen. Der Notfall-Rückweg zu 2.2.x geht danach weiter, nur
      „Einmalpasswort erzeugen" scheitert dort (500, nichts geändert) — in
      [05](05-sicherung-und-notfall.md) vermerkt.
      **Ergebnis 01.10.2026:** Der PR war beim Lesen schon gemergt und
      deployt (`4a8fb422`, 111 Migrationen, 0 fehlgeschlagen). Kein
      Ausfall: Der zuvor laufende Test-Stand `9f39d293` schrieb
      `password_plain` an keiner Stelle mehr. `test-backend.yml` auf
      `4a8fb422` gebaut; der Deploy hat `backend-test` mit dem neuen
      Image erstellt, `/api/status` des Test-Backends meldet `4a8fb422`.
- [x] **Zwei react-router-Alerts schließen (lokaler Agent, 5 Minuten).**
      Simon, 01.10.2026: „ja". GHSA-wrjc-x8rr-h8h6 und GHSA-337j-9hxr-rhxg
      auf `react-router` 6.30.6 (Begründung: [offene Befunde
      Nr. 15](../../offene-befunde.md)). Die Nummern der offenen Alerts:
      `gh api 'repos/Revisor01/Konfi-Quest/dependabot/alerts?state=open' --jq
      '.[] | select(.dependency.package.name=="react-router") | .number'`;
      je Nummer `gh api -X PATCH
      repos/Revisor01/Konfi-Quest/dependabot/alerts/<nr> -f state=dismissed
      -f dismissed_reason=tolerable_risk -f dismissed_comment="Kein SSR,
      Navigationsziele nur aus festen Pfaden; Fix nur in 7, @ionic/react-router
      verlangt <7. docs/offene-befunde.md Nr. 15"`. Danach zeigt GitHub auf
      main 0 offene Alerts; das Ergebnis mit Datum in Nr. 15 eintragen.
      **Ergebnis 01.10.2026:** Alerts #213 (GHSA-337j-9hxr-rhxg) und
      #214 (GHSA-wrjc-x8rr-h8h6) als „tolerable risk" geschlossen,
      danach 0 offene Dependabot-Alerts.
- [x] **Erinnerung „Gleich" nachmessen (lokaler Agent, 5 Minuten, nur
      Zeiten):** Simon bekam am 01.10.2026 um 14:47 Uhr die Erinnerung „In 1
      Stunde" zu einem Event um 16:00 Uhr. Der Code erklärt es (Fenster ±15
      Minuten, Takt ab dem Containerstart, behoben im PR nach #211). Gegenprobe
      in der Datenbank: für die `event_reminders`-Zeilen mit `reminder_type =
      '1_hour'` vom 01.10. den Abstand `events.event_date - sent_at` und die
      Minute von `sent_at`. Erwartet: Abstände zwischen 45 und 75 Minuten, der
      fragliche bei rund 73, und die Sendeminuten zwischen zwei Deploys im
      selben Viertelstunden-Raster wie der Start des Containers. Keine Namen, nur Zeiten. Weicht es ab, an Simon.
      **Ergebnis 01.10.2026:** bestätigt. Drei Versandzeitpunkte am
      01.10. (UTC): 12:47:06 für Events um 15:58 und 16:00 (71 bzw. 73
      min vorher, 17 Empfänger:innen) und 13:57:51 für 17:00 (62 min,
      7). Raster: Deploy 11:02:29 → Takt 11:02 … 12:47; Container-start
      13:27:49 → 13:42, 13:57. Alle Abstände zwischen 45 und 75 min.

### Bleibt beim lokalen Agenten

- [ ] Postgres und Log-Zusammensetzung an einem Abend unter Last messen.
- [ ] `pg_stat_statements` ab dem 04.10.2026 auswerten (dann ist die Woche voll).
- [ ] Ab 08.10.2026: uid fest ins Image (Nutzer 10001 anlegen) oder `user:` im
      Stack belassen (Auftrag 09).
- [ ] Anfang November die Umami-Bereinigung wiederholen (Auftrag 03).
- [ ] Beim nächsten Gerätetest den Bildversand im Chat prüfen (neue
      Dateirechte).

## Stand 30.09.2026, nachmittags — was jetzt ansteht

Seit dem Vormittag sind drei weitere Stände auf `main` und damit in Produktion
(welcher läuft, meldet `/api/status` als `commit`):

- **Paket J** (Merge `4145114b`, PR #198): Benutzernamen systemweit unter
  einer Sperre, Serienanlage ohne gleichzeitige Abfragen auf einem Client,
  Notfall-Deploy mit leerem Tag, Tests, Abhängigkeiten. Darunter im **Backend**
  neue Laufzeitpakete: `firebase-admin` 14.5.0 (zieht `google-auth-library` 11
  und `google-gax` 6 nach) und `socket.io` 4.8.4. Keine Migration.
- **Frontend-Bibliotheken** (Dependabot #199): Capacitor 8.5.2, Ionic 9.0.5,
  biometric 8.6.11, socket.io-client 4.8.4, vite 8.3.1 u. a. Ändert die
  Web-Version und den nativen Teil der Apps.
- **Testbuilds** Android versionCode 130 (intern) und iOS-Build 236
  (TestFlight), gebaut von `main` nach diesen beiden Ständen. Ersetzen 129/235
  für die Gerätetests vor dem Store-Release.

Die Migrationen stehen weiter bei `185_push_tokens_app_symbol_weg.sql`. Was im
Repo erledigt ist, steht an den Befunden in
`docs/audit/2026-09-28/offene-punkte.md` (Abschnitt „Paket J" für heute); hier
bleibt, was nur am Server oder in den Konsolen geht.

Reihenfolge nach Nutzen:

1. **Push nach dem Paket-Update prüfen (neu, zuerst, 10 Minuten):**
   `firebase-admin` 14.5.0 ist in den Tests nur gegen Attrappen geprüft. In den
   Logs **beider** Backends seit dem Deploy von `4145114b` nach `Push failed`,
   `messaging/` und `app/invalid-credential` suchen und die Zahl der
   versendeten Mitteilungen mit dem Vortag vergleichen (gleiche Tageszeit).
   Ein Fehler hier geht sofort an Simon — Rückweg ist der Notfall-Deploy auf
   `76178ec` (Auftrag 05; vorher Probelauf).
2. **[10 Deploy-Lücke](10-deploy-luecke.md)** — der einzige offene Befund, den
   Nutzer:innen spüren: Jeder Deploy erstellt beide Backends zugleich neu.
   Heute gab es drei Deploys; der von `4145114` wurde deshalb rot (erste
   Verify-Abfrage ohne Antwort, Stand trotzdem live). Seit PR #200 steht bei
   jedem Deploy die Zeile `Nach dem Tausch N Fehlantwort(en) in X s` im Log —
   auswerten, dann die Ursache messen (Auftrag 10, Nachtrag 30.09.).
3. **[05 Sicherung und Notfall](05-sicherung-und-notfall.md), Abschnitt 3** —
   der Probelauf mit **leerem Tag** jetzt wiederholen (der Fix ist auf `main`):
   erwartet grün und als Stand der zuletzt gebaute `main`-Commit. Danach, mit
   Ansage an Simon, der echte idempotente Lauf. Abschnitte 1–2 (Sicherung,
   Rückspielprobe) wie beschrieben.
4. **[03 nach dem Deploy](03-nach-dem-deploy.md)** — Abschnitte 1–3 (Stand,
   Nachher-Messungen, Log-Volumen) und 6 (Umami bereinigen). Abschnitt 4
   (Screenshots) ist Auftrag 08.
5. **[11 Datenbank](11-schema-und-rueckspielprobe.md)** — Abschnitt 1 ist
   überholt (siehe dort), 2–4 gelten: Schema gegen das Repo, Zeitzone im
   Stack, SMTP-Grenze, Rückspielprobe mit dem echten Dump.
6. **[07 Client-Adresse](07-client-adresse-hinter-dem-proxy.md)** und
   **[06 Mischkonten](06-mischkonten.md)** — reine Messungen.
7. **[08 Screenshots](08-screenshots-2.3.md)** — der Stand ist live, die Bilder
   können gezogen werden; danach der Handbuch-Generator.
8. **[09 Backend-Container](09-backend-container.md)** — Healthcheck ohne curl,
   Backend ohne root.
9. **[02 Portainer-Stack](02-portainer-stack.md)** — die offenen Beobachtungen
   (genau ein Backend startet die Hintergrund-Jobs, Vortags-Erinnerung kommt
   einmal), `RUN_BACKGROUND_JOBS=false` bei `backend2` entfernen (entscheidet
   seit 2.3.0 nur noch, ob sich eine Replica als Leader bewirbt) und
   `backend-test` in Portainer auf `test-latest` stellen.
10. **[04 CI](04-ci.md)** — im Repo fast alles erledigt (siehe dort); offen nur
    der Blick in die Browser-Konsole unter der öffentlichen Adresse (CSP).

Nicht für den lokalen Agenten, sondern bei Simon:

- **Gerätetests mit Android 130 und iOS 236** — die Liste in
  `docs/audit/2026-09-28/offene-punkte.md`, Abschnitt „Messen in Produktion und
  am Gerät", dazu wegen der neuen Bibliotheken: Anmelden mit Gesicht bzw.
  Fingerabdruck, eine Mitteilung kommt an und führt zum Ziel, Datei öffnen und
  teilen, auf dem iPhone ein Tipp auf die Statusleiste scrollt nach oben
  (entscheidet, ob `@capacitor/status-bar` bleibt).
- Store-Release 2.3.0 mit Store-Texten und Git-Tag `2.3.0`, Universal Links
  (Entitlement), die Firebase-Schlüssel in der Google-Cloud-Konsole, die zwei
  react-router-Alerts auf GitHub schließen (`docs/offene-befunde.md` Nr. 15)
  und die offenen Fragen in `docs/audit/2026-09-28/offene-punkte.md`, Abschnitt
  „Bei Simon".

| Datei | Inhalt | Wann |
|---|---|---|
| [00-ablauf-release-2.3.0.md](00-ablauf-release-2.3.0.md) | Phasen A–D: vor dem Merge, Merge und Deploy, Testbuilds, danach | zuerst lesen |
| [01-vor-dem-deploy.md](01-vor-dem-deploy.md) | Sicherung, Mail-Variablen und Zertifikat, Zählungen, Vorher-Messungen | vor dem ersten Deploy von 2.3.0 |
| [02-portainer-stack.md](02-portainer-stack.md) | Stack an die Referenz angleichen, Postgres, zweistufiger Deploy, Hintergrundjobs | um den Deploy herum, Reihenfolge beachten |
| [03-nach-dem-deploy.md](03-nach-dem-deploy.md) | Nachher-Messungen, Screenshots, Absender, Log-Volumen, Umami bereinigen | nach dem Deploy |
| [04-ci.md](04-ci.md) | Offene Workflow-Punkte aus dem Audit | nach dem Merge von 2.3.0 nach `main` |
| [05-sicherung-und-notfall.md](05-sicherung-und-notfall.md) | Sicherungs-Rhythmus, Rückspielprobe, Notfall-Deploy proben | nach dem Deploy, dann regelmäßig |
| [06-mischkonten.md](06-mischkonten.md) | Konten messen, die Konfi und Team zugleich sind (Altbestand), und verschiedene Team-Rollen je Gemeinde | nach dem Deploy, vor dem Gespräch „Mehrfach-Konten" |
| [07-client-adresse-hinter-dem-proxy.md](07-client-adresse-hinter-dem-proxy.md) | Kommt die echte Client-Adresse im Backend an? Messung, ggf. Proxy-Einstellung (Sicherheit BF-13) | nach dem Deploy des Stands vom 29.09.2026 |
| [08-screenshots-2.3.md](08-screenshots-2.3.md) | Die 42 Handbuch- und Store-Bilder neu ziehen: welche, warum, woran ein gelungenes Bild zu erkennen ist (UI BF-09) | nach dem Deploy des Stands vom 29.09.2026 |
| [09-backend-container.md](09-backend-container.md) | Healthcheck des Stacks ohne curl, Backend als Nutzer ohne root (CI BF-06) | nach dem Deploy des Stands vom 29.09.2026 |
| [10-deploy-luecke.md](10-deploy-luecke.md) | Deploy-Lücke messen: Erstellt Portainer beim Update alle Dienste (auch Postgres) neu? Postgres per Digest (CI BF-05) | beim nächsten Deploy |
| [11-schema-und-rueckspielprobe.md](11-schema-und-rueckspielprobe.md) | Zählungen vor den Migrationen 174–178, Schema der Produktion gegen das Repo, Rückspielprobe mit dem Skript, Zeitzone im Stack, SMTP-Grenze | vor und nach dem Deploy des Stands vom 29.09.2026 |

## Regeln

- **CLAUDE.md gilt.** Vor allem: ausgelieferte Apps nie brechen, Tests im
  selben Commit, Conventional Commits auf Deutsch, keine Verweise auf
  KI-Werkzeuge, Git-Tags ohne `v`, Versionsnummern nur über
  `npm run version:setzen`.
- **Nichts Geheimes ins Repo.** Keine Hostnamen, IP-Adressen, Stack-IDs,
  Zugangsdaten, Pfade auf dem Server, Container-Namen. In Commits, Berichten
  und diesen Dateien stehen Platzhalter (`<SMTP_HOST>`) oder Variablennamen.
  Was der Betrieb sich merken muss, gehört in die eigene Betriebsdoku außerhalb
  des Repos.
- **Messen, nicht schätzen.** Jede Aussage mit Zahl („Lücke 14 s → 0 s"), jede
  Behauptung aus einem Bericht erst am Code oder an Produktion prüfen — ein
  Befund ist eine Behauptung, keine Tatsache.
- **Vorher sichern.** Vor jedem Eingriff in Datenbank oder Stack eine
  Sicherung nach [docs/betrieb/sicherung.md](../../betrieb/sicherung.md), und
  den Stand der Stack-Definition exportieren.
- **Nichts an Produktionsdaten ändern**, außer ein Auftrag sagt es
  ausdrücklich. Messungen sind Lese-Abfragen.
- **Im Zweifel Simon fragen**, besonders bei allem, was Gemeinden sehen
  (Absender-Adresse, Wartungsfenster, Ausfallzeiten).

## Rückmeldung

- Je Punkt das Kästchen abhaken und darunter eine Zeile **Ergebnis** mit Datum
  und Messwert ergänzen. Nichts löschen, auch nicht, was sich als unnötig
  herausstellt — dann „entfällt, weil …".
- Betrifft ein Punkt einen Befund aus `docs/audit/2026-09-26/`, dort die
  Status-Zeile ergänzen („behoben TT.MM.JJJJ — …" mit Messwert), wie in den
  Berichten üblich.
- Code- und Workflow-Änderungen als Commits auf einem eigenen Branch, per
  Pull Request nach `main`; die CI muss grün sein.

## Stand bei der Übergabe

- Apple: Die beiden im Audit genannten Schlüssel hat Simon am 27.09.2026
  widerrufen (Sicherheit BF-02, Blocker 3). Nichts zu tun.
- Workflow-Patch vom 26.09. (Test-Gate vor Store-Builds, `concurrency` auf dem
  Deploy, Typprüfung und Web-Build im Test-Job, Tag-Rewrite ohne
  `backend-test`) ist angewendet. Was davon offen blieb, steht in
  [04-ci.md](04-ci.md).
- Die Referenz für den Stack ist `deploy/compose.konfi_quest.yml`, der rollende
  Deploy `deploy/rollend.sh`, die Sicherung `deploy/sicherung.sh` und
  `docs/betrieb/sicherung.md`.
