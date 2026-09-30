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

## Stand 30.09.2026 — was jetzt ansteht

Release 2.3.0 und das Großpaket vom 29.09. sind in Produktion (Deploy vom
29.09.2026, 19:02 UTC, Commit `67c03dca`; Sicherheitsupdate `engine.io` vom
30.09., Deploy 06:51 UTC, Merge `76178ec0`). Die Migrationen bis `185_push_tokens_app_symbol_weg.sql`
sind gelaufen. Testbuilds: Android versionCode 129 (intern), iOS-Build 235
(TestFlight). Was im Repo erledigt ist, steht an den Befunden in
`docs/audit/2026-09-28/offene-punkte.md`; hier bleibt, was nur am Server oder
in den Konsolen geht. Die Aufträge 01–03 stammen vom Release 2.3.0: Ihre
Messungen gelten weiter, ihre **Erwartungswerte** nicht überall (Migrationen
jetzt bis 185, nicht 168).

Reihenfolge nach Nutzen:

1. **[10 Deploy-Lücke](10-deploy-luecke.md)** — der einzige offene Befund, den
   Nutzer:innen spüren: Jeder Deploy erstellt beide Backends zugleich neu
   (Warnung im Deploy-Log vom 29.09. und 30.09.2026). Beim nächsten Deploy messen.
2. **[03 nach dem Deploy](03-nach-dem-deploy.md)** — Abschnitte 1–3 (Stand,
   Nachher-Messungen, Log-Volumen) und 6 (Umami bereinigen). Abschnitt 4
   (Screenshots) ist jetzt Auftrag 08.
3. **[11 Datenbank](11-schema-und-rueckspielprobe.md)** — Abschnitt 1 ist
   überholt (siehe dort), 2–4 gelten: Schema gegen das Repo, Zeitzone im
   Stack, SMTP-Grenze, Rückspielprobe mit dem echten Dump.
4. **[07 Client-Adresse](07-client-adresse-hinter-dem-proxy.md)** und
   **[06 Mischkonten](06-mischkonten.md)** — reine Messungen.
5. **[08 Screenshots](08-screenshots-2.3.md)** — der Stand ist live, die Bilder
   können jetzt gezogen werden; danach der Handbuch-Generator.
6. **[09 Backend-Container](09-backend-container.md)** — Healthcheck ohne curl,
   Backend ohne root.
7. **[05 Sicherung und Notfall](05-sicherung-und-notfall.md)** — erst den
   Probelauf des Notfall-Deploys, dann einen echten, idempotenten Lauf.
8. **[02 Portainer-Stack](02-portainer-stack.md)** — die offenen Beobachtungen
   (genau ein Backend startet die Hintergrund-Jobs, Vortags-Erinnerung kommt
   einmal), `RUN_BACKGROUND_JOBS=false` bei `backend2` entfernen (entscheidet
   seit 2.3.0 nur noch, ob sich eine Replica als Leader bewirbt) und
   `backend-test` in Portainer auf `test-latest` stellen.
9. **[04 CI](04-ci.md)** — im Repo fast alles erledigt (siehe dort); offen nur
   der Blick in die Browser-Konsole unter der öffentlichen Adresse (CSP).

Nicht für den lokalen Agenten, sondern bei Simon: die Gerätetests (Android
129, iOS 235), der Store-Release 2.3.0 mit Store-Texten und Git-Tag `2.3.0`,
Universal Links (Entitlement), die Firebase-Schlüssel in der Google-Cloud-Konsole
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
