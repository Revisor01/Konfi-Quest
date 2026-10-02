# Wiederkehrende Routinen im Betrieb

Was im Betrieb regelmäßig oder bei einem bestimmten Anlass wiederkommt, und
nach welchen Regeln. Adressen, Zugangsdaten, Container- und Pfadnamen stehen
nicht hier — das Repo ist öffentlich; sie gehören in die Betriebsdoku
außerhalb des Repos. Wer welche Aufgabe gerade übernimmt, steht in
[auftraege/lokaler-agent/README.md](../auftraege/lokaler-agent/README.md).

## Regeln

- **Vorher sichern.** Vor jedem Eingriff in Datenbank oder Stack eine
  Sicherung nach [sicherung.md](sicherung.md) und den Stand der
  Stack-Definition aus Portainer exportieren.
- **Nichts an Produktionsdaten ändern**, außer ein Auftrag sagt es
  ausdrücklich. Messungen sind Lese-Abfragen.
- **Messen, nicht schätzen.** Jede Aussage mit Zahl und Datum; ein Befund ist
  eine Behauptung, bis er am Code oder in Produktion geprüft ist.
- **Im Zweifel Simon fragen** — besonders bei allem, was Gemeinden sehen:
  Absender, Wartungsfenster, Ausfallzeiten.
- **Nichts Geheimes ins Repo**: In Commits und Doku stehen Platzhalter
  (`<SMTP_HOST>`) oder Variablennamen, keine Werte, Hosts, IP-Adressen,
  Stack-IDs oder Zugangsdaten.

**Beim Messen beachten:** Die Backends arbeiten in UTC, ihre
Datenbanksitzungen ebenso. `psql` im Postgres-Container zeigt dagegen Berliner
Zeit, weil dort `PGTZ` gesetzt ist — wer so misst, sieht nicht, was die App
sieht. Gleich wie die App: `env -u PGTZ psql …`. Zeitstempel ohne Zone
(`timestamp`) stehen in UTC.

## Überblick

| Was | Wann | Abschnitt |
|---|---|---|
| Umami bereinigen | monatlich, nächster Lauf Anfang November 2026 | [Umami bereinigen](#umami-bereinigen) |
| Schema-Dump fortschreiben | mit jedem Release | [Schema-Dump fortschreiben](#schema-dump-fortschreiben) |
| Rückspielprobe | vor jedem Release, nach Änderungen an Postgres oder am Sicherungsskript | [sicherung.md](sicherung.md#rückspielprobe) |
| Stand prüfen | nach jedem Deploy | [Nach jedem Deploy](#nach-jedem-deploy) |
| Test-Backend nachziehen | nach einem Merge, der das Schema ändert | [Test-Backend nachziehen](#test-backend-nachziehen) |
| Notfall-Deploy | wenn ein gebauter Fix sofort raus muss oder zurückgerollt wird | [Notfall-Deploy](#notfall-deploy) |
| Apple-Zertifikat erneuern | jährlich, jetzt vor dem 28.11.2026 | [release.md](release.md#8-das-apple-zertifikat-jährlich-erneuern) |

## Umami bereinigen

Bis zum Deploy von 2.3.0 schickte die App den angezeigten Fehlertext als
Merkmal `stelle` des Ereignisses `fehler` an die Nutzungsmessung — auch
Server-Texte mit Namen, Dateinamen und Namen von Konfirmationsterminen. Seitdem
geht nur ein Wert aus einer festen Liste
(`frontend/src/utils/bekannteFehlertexte.ts`) oder `andere-meldung`. Ältere
Store-Fassungen schicken bis zu ihrem Update weiter den vollen Text; deshalb
**monatlich** bereinigen, bis keine Werte außerhalb der Liste mehr ankommen.
Hintergrund: [messung/umami.md](../messung/umami.md), Befund B1. Diese Routine
ändert ausdrücklich Produktionsdaten: Sie entfernt personenbezogene Daten, die
nie hätten gespeichert werden dürfen.

`<APP_WEBSITE_ID>` ist `WEBSITE_ID` aus `frontend/src/services/analytics.ts`,
die Kennung der **App**, nicht die der Startseite.

1. **Umami-Datenbank sichern.** Diese Sicherung enthält die Namen noch: nach
   der geprüften Bereinigung löschen, nicht in den Sicherungsbestand nehmen.
2. **Erlaubte Werte aus dem deployten Stand erzeugen** (Repo-Wurzel, auf dem
   Commit, der live ist — die Liste wächst mit neuen Meldungen der App):

   ```bash
   node frontend/scripts/fehlerstellen-sql.mjs > erlaubte_stelle.sql
   ```

   Das legt eine temporäre Tabelle `erlaubte_stelle(wert)` an. Alles Weitere
   in **derselben** `psql`-Sitzung: `\i erlaubte_stelle.sql`; die letzte Zeile
   nennt die Zahl der Werte (01.10.2026: 229).
3. **Spalten prüfen:** `\d event_data` und `\d website_event`. Erwartet:
   `event_data.website_event_id`, `data_key`, `string_value`;
   `website_event.event_id`, `website_id`, `event_name`, `created_at`.
   Weicht etwas ab, die Abfragen anpassen, nicht raten.
4. **Zählen** — ins Ergebnis nur Zahlen, keine Werte:

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

5. **Ersetzen** — die Zahl der Fehler-Ereignisse und ihre Merkmale `art` und
   `ort` bleiben, der Text ist weg:

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
   -- "UPDATE n": n muss "eintraege" aus Schritt 4 sein, sonst ROLLBACK;
   COMMIT;
   ```

   Ganz löschen statt ersetzen nur nach Rücksprache mit Simon.
6. **Nachzählen:** Schritt 4 ergibt 0. Dann die Sicherung aus Schritt 1
   löschen.

Ergebnis mit Datum und Zahlen festhalten (erster Lauf 01.10.2026: 31 Einträge
mit 14 verschiedenen Werten ersetzt, danach 0). Kommt mehrere Monate in Folge
nichts mehr, endet die Routine.

## Schema-Dump fortschreiben

Die Backend-Tests und eine neue Instanz bauen ihre Datenbank aus einem
Schema-Dump (`backend/tests/schema/prod-schema.sql`, gespiegelt nach
`init-scripts/`), auf den die Migrationen laufen. Mit jedem Release im
Release-Zweig fortschreiben und das Ergebnis mitcommitten:

```bash
bash backend/tests/schema/schema-erneuern.sh <letzte Migration der Produktion>
```

Das Skript braucht Docker und keinen Zugang zur Produktion. Der Test
`backend/tests/schema/dumpAktualitaet.test.js` schlägt an, wenn mehr als 20
Migrationen über dem Dump liegen. Ob die Produktion dem Repo entspricht,
misst der Betrieb mit `backend/scripts/schemaVergleich.js` (`erfassen` in der
Produktion, `vergleichen` gegen einen Stand aus `init-scripts/` und den
Migrationen); zuletzt am 01.10.2026: gleich, bis auf die Erweiterung
`pg_stat_statements`, die bewusst nur im Betrieb liegt.

## Nach jedem Deploy

- `GET /api/status` mehrfach, damit beide Backends antworten: `version` gleich
  `frontend/version.json`, `commit` gleich dem ausgerollten Commit,
  `checks.database` und `checks.migrations` `ok`, `checks.cron_leader` `ok`
  (genau eine Replica fährt die Hintergrund-Jobs).
- Im Log des Jobs `deploy`: je Stufe „Stufe …: keine anderen Dienste neu
  erstellt." Die Warnungen „Stufe … hat auch … mit neu erstellt" und „Nach
  dem Tausch N Fehlantwort(en)" heißen, dass der Tausch nicht lückenlos war
  (Ursache bis 01.10.2026: Portainer erstellte mit `pullImage: true` alle
  Dienste neu, auch Postgres).
- In den Logs beider Backends `Migration FAILED`: erwartet 0.

## Test-Backend nachziehen

Der Deploy schreibt nur `backend`, `backend2` und `frontend` um.
`backend-test` läuft auf dem Image `test-latest`, das `test-backend.yml` baut,
und hängt an derselben Datenbank. Ändert ein Merge das Schema so, dass der
alte Test-Stand daran scheitern könnte: `test-backend.yml` auf `main` laufen
lassen, das Image ziehen, `backend-test` neu erstellen und an
`/api/status` des Test-Backends den Commit prüfen.

## Notfall-Deploy

`.github/workflows/notfall-deploy.yml` rollt einen **schon gebauten** Stand
aus, ohne Tests und Build — wenn ein Fix gebaut ist, die Pipeline ihn aber
aufhält, oder zum Zurückrollen. Er nimmt denselben Weg wie jeder CI-Deploy
(`deploy/rollend.sh`, zwei Stufen) und läuft in derselben
`concurrency`-Gruppe; ein wartender CI-Deploy wird dabei ersetzt.

1. **Probelauf** — ändert nichts, jederzeit ohne Rücksprache möglich:

   ```bash
   gh workflow run notfall-deploy.yml --ref main -f grund="Probelauf" -f probelauf=true
   # mit bestimmtem Stand zusätzlich: -f image_tag=<7 Zeichen>
   ```

   Erwartet: grün, im Log „OK Probelauf", die drei Dienste mit `alt -> neu`,
   `backend-test` unverändert, „update_stack wurde NICHT aufgerufen". Ohne
   `image_tag` sucht `deploy/notfall-tag.sh` rückwärts den jüngsten Commit,
   zu dem beide Images auf ghcr liegen.
2. **Ernstfall** — mit Ansage an Simon und Grund:

   ```bash
   gh workflow run notfall-deploy.yml --ref main -f grund="<warum>" -f image_tag=<7 Zeichen>
   ```

3. Danach wie [nach jedem Deploy](#nach-jedem-deploy).

**Zurückgerollt wird nur der Code.** Migrationen bleiben; der ältere Code muss
auf dem neueren Schema laufen (CLAUDE.md, Migrationen additiv). Geprüft am
01.10.2026: Der Stand 2.2.x startet gegen die Datenbank nach 2.3.0 und
beantwortet Anmeldung und Lese-Abfragen; seit Migration 187 scheitert dort
allein „Einmalpasswort erzeugen" (500, nichts geändert). Vor dem Zurückrollen
über eine neue Migration hinweg prüfen, ob sie etwas entfernt oder umbenennt.

Simon, 01.10.2026: Ein echter Lauf zum Üben entfällt, der Probelauf genügt
(zuletzt grün am 01.10.2026 in 19 s).
