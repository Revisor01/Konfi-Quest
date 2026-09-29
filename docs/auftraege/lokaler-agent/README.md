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
