# Aufträge für den lokalen Agenten

Simon betreibt Konfi Quest selbst und gibt Arbeiten am Server an einen
lokalen Agenten ab, der Zugang zu Server, Portainer, GitHub (auch Workflows),
Mail-Konto und Umami hat. Die Entwicklung in der Cloud hat diesen Zugang
nicht; was nur am Server, in einer Konsole oder in den Logs geht, steht als
Auftrag hier. Die Dateien sagen, **was** zu tun ist und woran man merkt, dass
es stimmt. **Wo** etwas liegt und **womit** man sich anmeldet, steht nicht
hier — dieses Repo ist öffentlich.

## Regeln

Es gelten [CLAUDE.md](../../../CLAUDE.md) und die Regeln für den Betrieb in
[docs/betrieb/routinen.md](../../betrieb/routinen.md#regeln): vorher sichern,
nichts an Produktionsdaten ändern ohne ausdrücklichen Auftrag, messen statt
schätzen, nichts Geheimes ins Repo, im Zweifel Simon fragen. Ein Merge nach
`main` ist der Produktions-Deploy; den Merge gibt Simon frei.

## Aktuell

- **[16-support-vorgaenge-probelauf.md](16-support-vorgaenge-probelauf.md)** —
  nach dem Deploy des PRs „Web-Ansicht aller Bereiche und Support-Vorgänge"
  (06.10.2026), alle Schritte offen: Übernahme in Vorgänge prüfen,
  Probe-Anfrage 1 als Vorgang, Probe-Anliegen über das Support-Formular,
  Posteingang mit Einsortieren und Archiv, Mail von einem Leitungskonto der
  Gemeinde 4; danach liegen lassen, bis Simon sie angesehen hat. Den
  Probelauf vom 03.10.2026 (Auftrag 15) führt er fort.
- **[17-web-live-weiterbauen.md](17-web-live-weiterbauen.md)** — Einrichtung
  und erste Wünsche erledigt (07.10.2026, #229, #230); bleibt die Anleitung,
  wenn Simon die Web-Fassung live am eigenen Rechner weiterbaut. Fallen beim
  lokalen Start: [wissen/lokal-entwickeln.md](../../wissen/lokal-entwickeln.md).
- **[18-agp9-android-2.4.0.md](18-agp9-android-2.4.0.md)** — mit 2.4.0:
  versionCode 135 liegt im internen Testtrack (08.10.2026); offen sind Maltes
  Rückmeldung je Prüfpunkt und das Ausliefern mit 2.4.0.
- **Umami bereinigen, Anfang November 2026** — monatliche Routine nach
  [docs/betrieb/routinen.md](../../betrieb/routinen.md#umami-bereinigen).

Was im Betrieb sonst offen ist (Referenz-Compose, Aufbewahrung der
Sicherungen, Drossel des Massenversands, Zählungen), steht in
[docs/offene-befunde.md](../../offene-befunde.md), Abschnitt „Betrieb"; ein
Auftrag daraus entsteht, wenn Simon ihn erteilt. Wiederkehrendes — Schema-Dump,
Rückspielprobe, Prüfung nach dem Deploy, Notfall-Deploy — steht in
[docs/betrieb/routinen.md](../../betrieb/routinen.md), der Release-Ablauf in
[docs/betrieb/release.md](../../betrieb/release.md).

Die erledigten Aufträge 00–15 (27.09.–08.10.2026) liegen mit allen Messwerten
in der Git-Historie ([docs/README.md](../../README.md#erledigte-aufträge-und-frühere-listen)).

## Rückmeldung

- Je Punkt das Kästchen abhaken und darunter eine Zeile **Ergebnis** mit Datum
  und Messwert ergänzen; was sich als unnötig herausstellt, mit „entfällt,
  weil …". In Ergebnisse gehören Zahlen und Kennungen, keine Namen, Adressen
  oder Werte von Geheimnissen.
- Ändert ein Ergebnis den Stand eines offenen Punkts, den Eintrag in
  [docs/offene-befunde.md](../../offene-befunde.md) anpassen oder — wenn er
  erledigt ist — streichen und im Commit sagen, womit.
- Ergebnisse in diesen Dateien dürfen direkt auf `main`: Änderungen nur unter
  `docs/auftraege/` lösen keinen Deploy aus. Code-, Workflow- und
  Compose-Änderungen als Pull Request; die CI muss grün sein.
- Ist ein Auftrag erledigt, wird seine Datei gelöscht; was regelmäßig
  wiederkommt, wandert vorher nach `docs/betrieb/`.
