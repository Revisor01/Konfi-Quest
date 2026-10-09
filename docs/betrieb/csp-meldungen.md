# Meldungen der Sicherheitsregeln (CSP) lesen

Die Web-Fassung trägt eine scharfe Content-Security-Policy: Der Browser lädt
nichts, was sie nicht erlaubt — kein Skript, Bild, Stylesheet oder Aufruf von
einer Adresse, die nicht in den Regeln steht. Jeden solchen Fall meldet der
Browser an das Backend. Wo die Regeln stehen und warum, steht im Kopf der
Policy in `frontend/nginx.conf`; die Route ist in der API-Doku beschrieben
(`POST /api/csp-meldung`, `docs/api/verwaltung-auth.yaml`).

Die Apps im Store laden ihre Dateien aus dem App-Paket und tragen keine
Policy. Meldungen kommen deshalb nur aus dem Browser.

## Wo die Meldungen stehen

- **Betrieb, Reiter „Fehler“** (`/admin/metrics`, nur Super-Admin): Karte
  **Vom Browser blockiert** in der Web-Fassung, darunter in der App derselbe
  Abschnitt als Liste. Je Zeile: die Regel (Direktive), was blockiert wurde,
  auf welcher Seite, wie oft, erstmals und zuletzt.
- **`GET /api/metrics`**, Feld `cspMeldungen` — dieselben Zahlen, über alle
  Replicas zusammengefasst.
- **Container-Protokoll des Backends**: Die erste Meldung jeder neuen Gruppe
  steht dort als eine Zeile `[CSP] <Regel> blockiert <Adresse> auf <Seite>`.
  Wiederholungen zählen still.

Die Zähler liegen im Speicher der Replica, wie die Fehler-Gruppen daneben.
Ein Neustart oder Deploy leert sie; was älter ist, steht nur noch im
Protokoll.

## Was gespeichert wird

Nur, was zum Beheben nötig ist: die Regel, die blockierte Adresse ohne
Abfrage und Anker (bei `data:`, `blob:` und Browser-Erweiterungen nur das
Schema), der Pfad der Seite ohne Abfrage und mit Kennungen als `:id`, erstes
und letztes Auftreten, Anzahl. Nicht gespeichert werden Client-Adresse,
Browserkennung, Konto und der Codeauszug, den manche Browser mitschicken.

Je Replica höchstens 200 verschiedene Gruppen; was darüber kommt, zählt nur
noch als „weitere Meldungen“. Je Client-Adresse nimmt die Route 120 Sendungen
in der Stunde an, je Sendung höchstens 16 KiB.

## Eine Meldung einordnen

- **Blockiert ist eine Adresse, die die App wirklich braucht** (eine neue
  Schrift, ein Messdienst, eine Einbettung): Die Adresse fehlt in der
  passenden Direktive in `frontend/nginx.conf`. Eintragen, den Test
  `frontend/src/__tests__/betrieb/sicherheitsHeader.test.ts` ergänzen,
  deployen.
- **Blockiert ist `chrome-extension`, `moz-extension` oder
  `safari-web-extension`**: Eine Browser-Erweiterung der Person wollte etwas
  in die Seite schreiben. Kein Fehler der App; nichts zu tun.
- **Blockiert ist `inline` oder `eval`**: Etwas versucht, Code in der Seite
  auszuführen, der nicht aus der App kommt — meist ebenfalls eine
  Erweiterung. Häuft es sich auf einer bestimmten Seite der App, genauer
  hinsehen.
- **Viele Meldungen, eine Gruppe**: Eine Seite, die viele Personen öffnen,
  trifft dieselbe Lücke. Die Anzahl sagt, wie dringend es ist.
