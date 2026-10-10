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
sieht. Gleich wie die App: `env -u PGTZ psql …`. Seit Migration 206
(09.10.2026) trägt jede Zeitspalte eine Zone (`timestamptz`); ein von Hand
geschriebener Wert landet damit richtig, gleich in welcher Zone die Sitzung
läuft. „Heute" rechnet der Code als Berliner Tag
(`HEUTE_BERLIN_SQL` in `backend/utils/zeitformat.js`), nie mit `CURRENT_DATE`.

Vom 21. bis 23.08.2026 liefen alle Sitzungen der Backends in Berliner Zeit
(gemessen 09.10.2026, Ursache unbekannt); Migration 206 hat die Werte aus
diesem Zeitraum umgerechnet. Läuft eine Sitzung der App je wieder nicht in UTC,
zeigt es `SELECT current_setting('TimeZone')` über den Pool des Backends.

## Überblick

| Was | Wann | Abschnitt |
|---|---|---|
| Umami bereinigen | monatlich, nächster Lauf Anfang November 2026 | [Umami bereinigen](#umami-bereinigen) |
| Schema-Dump fortschreiben | mit jedem Release | [Schema-Dump fortschreiben](#schema-dump-fortschreiben) |
| Rückspielprobe | vor jedem Release, nach Änderungen an Postgres oder am Sicherungsskript | [sicherung.md](sicherung.md#rückspielprobe) |
| Stand prüfen | nach jedem Deploy | [Nach jedem Deploy](#nach-jedem-deploy) |
| Notfall-Deploy | wenn ein gebauter Fix sofort raus muss oder zurückgerollt wird | [Notfall-Deploy](#notfall-deploy) |
| Stack-Variablen wieder eintragen | wenn ein Deploy mit „Pflicht-Stack-Variablen fehlen" abbricht, wenn die Support-Mail aus ist | [Stack-Variablen](#stack-variablen) |
| Nachlauf-Warteschlange prüfen | nach jedem Deploy, bei Meldungen „Push kam nicht an" | [Nachlauf-Warteschlange](#nachlauf-warteschlange) |
| Hintergrund-Jobs prüfen | nach jedem Deploy, bei Meldungen „Erinnerung kam nicht", „Zahl am App-Symbol stimmt nicht" | [Hintergrund-Jobs](#hintergrund-jobs) |
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

Das Skript braucht Docker und keinen Zugang zur Produktion. Hinter das
Schema schreibt es die Datenzeilen, die die eingefalteten Migrationen selbst
anlegen (etwa die Rolle `super_admin` aus 190, die Textbausteine der
Support-Mail aus 193) -- ein reiner Schema-Dump verlöre sie, und eine neue
Instanz käme ohne Rolle nicht durch die Ersteinrichtung. Zuletzt gefaltet am
10.10.2026 bis 208. Der Test
`backend/tests/schema/dumpAktualitaet.test.js` schlägt an, wenn mehr als 20
Migrationen über dem Dump liegen. Ob die Produktion dem Repo entspricht,
misst der Betrieb mit `backend/scripts/schemaVergleich.js` (`erfassen` in der
Produktion, `vergleichen` gegen einen Stand aus `init-scripts/` und den
Migrationen); zuletzt am 01.10.2026: gleich, bis auf die Erweiterung
`pg_stat_statements`, die bewusst nur im Betrieb liegt.

Zwei Regeln hält das Test-Schema seit dem 10.10.2026 (Migrationen 210 und
211): Kein Einzelspalten-Index steht neben einem längeren, der dieselbe
Spalte vorn trägt (`migration210PraefixIndizes.test.js`), und jeder
Fremdschlüssel ist auf beiden Seiten `bigint`
(`migration211FremdschluesselBigint.test.js`). `bigint` kommt beim Backend
als Zahl an, weil `backend/database.js` dafür einen eigenen Typ-Parser setzt;
ohne ihn wären die Kennungen in jeder Antwort Zeichenketten
(`tests/routes/kennungenAlsZahl.test.js`). Wie lange eine Typänderung die
Tabellen sperrt, wächst mit dem Bestand: 0,3 s am Stand vom 10.10.2026, 4
bis 8 s mit den zwei größten Tabellen auf dem 110-Fachen (Messung in
Migration 211). Noch `integer` sind die Primärschlüssel von 18 Tabellen,
auf die kein Fremdschlüssel zeigt.

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
- `migrationen.gesamt` zählt die Dateien in `backend/migrations/` — seit dem
  Dump-Stand 208 nur die danach (ab `209`), nicht alle, die die Datenbank je
  bekommen hat. Eine kleine Zahl ist also kein Fehler. Ob die Datenbank
  vollständig ist, zeigt der Abgleich mit `schema_migrations` in
  [`init-scripts/README.md`](../../init-scripts/README.md#was-in-backendmigrations-liegt--und-was-nicht).

- Nachlauf-Warteschlange: `nachlauf` in `/api/status` zeigt
  `haengend: 0`; Einzelheiten mit der Abfrage im nächsten Abschnitt.
- Support-Mail: `support_mail` in `/api/status` zeigt `ok`. Auf der Seite
  „Betrieb" steht unter dem Urteil kein Kasten „Support-Mail"; sonst
  [Stack-Variablen](#stack-variablen).
- Hintergrund-Jobs: Nach rund fünf Minuten stehen auf der Seite „Betrieb"
  (Überblick, Karte „Hintergrund") der Zähler-Lauf und die Event-Erinnerungen
  mit „ok"; Einzelheiten im Abschnitt [Hintergrund-Jobs](#hintergrund-jobs).

## Nachlauf-Warteschlange

Push, Postfach-Eintrag und E-Mail nach einer Änderung stehen als Auftrag in
`nachlauf_auftraege` (Migration 202, `backend/utils/warteschlange.js`). Die
Route stößt ihren Auftrag sofort selbst an; ein Arbeiter auf jeder Replica
(alle 5 s, `NACHLAUF_TAKT_MS`) holt ab, was liegen blieb. Live-Updates laufen
weiter im Prozess und gehen bei einem Neustart verloren — die Apps laden nach
dem Wiederverbinden ohnehin neu.

**Zustände:** `offen` (wartet ab `faellig_ab`), `laeuft` (angenommen von
`gesperrt_von` bis `gesperrt_bis`, die Sperre wird während der Arbeit
verlängert), `erledigt`, `fehlgeschlagen` (nach `max_versuche`, Vorgabe 5).
Wiederholt wird nach 30 s, 1, 2, 4 … Minuten, höchstens stündlich; Teile, die
schon durch sind (`erledigte_schritte`), laufen nicht noch einmal.

**Beim Deploy** (Rolling, zwei Replicas): Die stoppende Replica nimmt nach
SIGTERM nichts Neues mehr an, wartet bis zu 3 s (`NACHLAUF_STOPP_MS`, gekürzt,
damit das Shutdown-Budget von 10 s reicht) und gibt Angefangenes an die
Schlange zurück; die andere Replica macht weiter. Kommt das Zurückgeben nicht
mehr durch, holt die andere den Auftrag nach Ablauf seiner Sperre (2 min,
`NACHLAUF_SPERRE_MS`). Ein Auftrag einer Art, die ein noch laufender alter
Stand nicht kennt, bleibt liegen, bis der neue Stand ihn nimmt. Der alte
Stand (vor Migration 202) arbeitet weiter im Prozess wie bisher.

**Aufräumen:** Erledigte Aufträge verlieren ihre Parameter sofort und gehen
nach 7 Tagen, fehlgeschlagene nach 30 Tagen (stündlich, jede Replica).

**Passwort vergessen** (`passwort_reset_mail`): Je Konto ein Auftrag mit nur
Konto-ID und „mehrere Konten ja/nein". Token und Hash entstehen erst beim
Ausführen, im selben Schritt wie der Versand — der Klartext-Token steht nie in
der Datenbank, auch nicht in fehlgeschlagenen Aufträgen, die 30 Tage liegen.
Scheitert der Versand, wird der Hash wieder gelöscht, und die Wiederholung
schickt einen neuen Link. Abgewogen (08.10.2026) gegen die einfachere Fassung,
den fertigen Link in den Auftrag zu legen und nach dem Versand zu löschen: Die
hätte den Token bis zum Versand und bei einem Fehlschlag einen Monat lang im
Klartext liegen lassen. Preis der gewählten Fassung: Bricht der Prozess
zwischen Versand und Vermerk ab, kommt eine zweite Mail mit einem zweiten,
ebenfalls gültigen Link.

**Gesendet-Ordner** (`mail_gesendet_ablegen`): Antworten der Support-Mail
gehen vor der Antwort per SMTP hinaus; die Kopie per IMAP in den
Gesendet-Ordner ist ein Auftrag mit dem Quelltext der Mail (base64), dem
Postfach und dem Sendezeitpunkt — keine Zugangsdaten, die kommen beim
Ausführen aus der Umgebung. Der Auftrag hat nur den Schritt `gesendet`; eine
Wiederholung legt höchstens ab, sendet aber nie ein zweites Mal. Der
Quelltext enthält Adressen und Text, dieselben, die ohnehin in
`mail_nachrichten` stehen.

**In `/api/status`** (öffentlich, 30 s zwischengespeichert): `nachlauf`
`{haengend, fehlgeschlagen}`. `haengend` zählt Aufträge, die seit mehr als
15 Minuten offen sind oder laufen — die Wiederholungen eines Auftrags sind
nach rund 7,5 Minuten durch, länger liegt nur, was kein Arbeiter annimmt.
`fehlgeschlagen` zählt die endgültig gescheiterten der letzten 24 Stunden.
Beides steht bewusst nicht in `checks` und ändert den HTTP-Status nicht: Ein
gescheiterter Push ist kein kaputter Server, Deploy-Verify und Überwachung
sollen daran nicht anschlagen. Gemessen 08.10.2026 mit 300.000 erledigten
Aufträgen: 17 ms für die Abfrage, fast alles für `fehlgeschlagen` (sie
filtert über den Teilindex der erledigten die rund 86.000 des letzten Tages).

**Instanz ohne Jobs** (`RUN_BACKGROUND_JOBS=false`, im Stack derzeit keine)
hätte keinen Arbeiter: Sie führte ihre eigenen Aufträge sofort aus, nähme aber
keine fremden an; scheitert dort einer, holt ihn ein Live-Backend bei der
Wiederholung.

**Prüfen** (Lese-Abfrage):

```sql
SELECT status, art, count(*) AS anzahl,
       min(erstellt_am) AS aeltester, max(letzter_fehler) AS ein_fehler
  FROM nachlauf_auftraege
 WHERE status IN ('offen', 'laeuft', 'fehlgeschlagen')
 GROUP BY status, art ORDER BY status, art;
```

Erwartet: `offen`/`laeuft` leer oder nur Minuten alt. `fehlgeschlagen` heißt,
eine Mitteilung ist endgültig nicht angekommen — `letzter_fehler` nennt den
Grund. Einen fehlgeschlagenen Auftrag erneut anstoßen (ändert
Produktionsdaten, nur nach Rücksprache): `status = 'offen'`,
`versuche = 0`, `faellig_ab = NOW()` setzen; Schritte in
`erledigte_schritte` laufen dabei nicht noch einmal.

## Hintergrund-Jobs

Die zeitgesteuerten Aufgaben (Zähler am App-Symbol, Abzeichen-Prüfung,
Event-Erinnerungen, Aufräumen, Testphase, Mails abholen …) fährt nur der
Cron-Leader (`checks.cron_leader` in `/api/status`). Je Job steht in
`GET /api/metrics` unter `hintergrund.jobs` (Seite „Betrieb", Karte
„Hintergrund"): letzter Start, Dauer des letzten Laufs, Ergebnis (`ok`,
`fehler` mit Text, `laeuft`), Zahl der Läufe und Fehler, längster Lauf.
Darunter `hintergrund.pushVersand`: je Weg (an eine Person, an viele, Chat)
Zahl, Mittel und längste Dauer des Versands, gemessen vom Aufruf bis zum
letzten Gerät — von jeder Replica, nicht nur vom Leader. Alles im Speicher der
Replica (`backend/utils/hintergrundLaeufe.js`); ein Neustart leert es, der
nächste Lauf füllt es.

**Im Protokoll** schreibt jeder Lauf der stündlichen und täglichen Jobs und
der Zähler-Lauf (alle 5 Minuten) eine Zeile
`Hintergrund: <Aufgabe> in <n> ms, ok (…)`, der Zähler-Lauf mit „x von y
Zählern gesetzt, z geprüft". Jobs im Minutentakt (Push „Anmeldung möglich",
Challenge-Start, Mails abholen, Kennzahlen sichern) schreiben nur ab einer
Sekunde oder bei einem Fehler. Ein Fehler erscheint zusätzlich als Warnung mit
Dauer; die Fehlerzeile selbst schreibt der Job wie bisher. Ein Versand an viele
schreibt `Push <art>: <n> Empfänger:innen in <ms> ms` erst ab fünf Sekunden.

**Prüfen:** Steht ein Job auf `fehler`, sagt `fehler` den Grund und das
Protokoll des Leaders zur Uhrzeit von `letzterStart` den Rest. Fehlt ein Job,
der laut Takt hätte laufen müssen, ist der Leader seit dem letzten Start
noch nicht so weit (tägliche Jobs erst zu ihrer Uhrzeit) — oder es gibt
keinen Leader: dann zeigt `checks.cron_leader` `fehlt`. Ein Zähler-Lauf über
10 s heißt, dass er an seine Obergrenze kommt (800 Personen je Lauf,
`backgroundService.ABZEICHEN_MAX_JE_LAUF`).

## Stack-Variablen

Die Werte, die der Live-Stack braucht (Zugangsdaten, Schlüssel, Hosts),
stehen als **Stack-Variablen in Portainer**, nie in der Stack-Datei und nie im
Repo. Die Referenz `deploy/compose.konfi_quest.yml` nennt nur ihre Namen.
Jeder Deploy (`deploy/rollend.sh`) liest die Variablen aus Portainer und
schickt sie beim Stack-Update unverändert zurück — Portainer ersetzt sie
sonst durch die mitgeschickte Liste.

Drei Sorten:

| Sorte | in der Stack-Datei | fehlt sie … |
|---|---|---|
| Pflicht, laut | `${NAME:?…}` (etwa `JWT_SECRET`, `SMTP_HOST`) | scheitert das Stack-Update selbst; der Deploy wird rot |
| Pflicht, still | `${NAME:-}`, gelistet in `deploy/stack-pflichtvariablen.txt` (die Zugänge der Support-Mail) | bricht der Deploy **vor** dem Stack-Update ab und nennt die Namen |
| optional | `${NAME:-}`, nicht gelistet (`APP_MIN_VERSION_IOS`, `APP_MIN_VERSION_ANDROID`, `WARTUNG_HINWEIS`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`) | ist die Funktion aus — gewollt, leer heißt „aus" |

Die stille Sorte ist der Grund für die Prüfung: Am 08.10.2026 verlor
Portainer bei einem Neustart alle Stack-Variablen. Der nächste Deploy
schickte die leere Liste zurück, die Container starteten ohne Zugänge zur
Support-Mail, und 46 Stunden lang wurden keine Mails abgeholt, ohne dass
etwas rot wurde. Am 10.10.2026 von Hand wiederhergestellt.

**Eine neue Variable**, ohne die eine Funktion still ausfällt, kommt in
`deploy/stack-pflichtvariablen.txt` — die eine Liste, die das Skript liest.
Der Test `rollenderDeploy.test.ts` prüft, dass jeder Name dort in der
Referenz-Compose als `${NAME:-}` steht.

**Bricht ein Deploy ab** mit „Pflicht-Stack-Variablen fehlen oder sind leer:
…", ist am Stack nichts geändert; Produktion läuft auf dem alten Stand
weiter. Geprüft wird zusätzlich vor dem Stack-Update der zweiten Stufe —
bricht es erst dort ab („vor dem Stack-Update der Stufe 'backend2'"), laufen
`backend` und `frontend` schon auf dem neuen Stand, `backend2` noch auf dem
alten; der wiederholte Lauf zieht ihn nach. Dann:

1. In Portainer beim Stack unter den Variablen nachsehen: Fehlen nur die
   genannten oder alle? Fehlen alle, hat Portainer sie verloren — die
   Sicherung der Stack-Definition (Regel „Vorher sichern" oben) und die
   Betriebsdoku außerhalb des Repos haben die Werte.
2. Die fehlenden Variablen mit Wert wieder eintragen. Werte nie in Logs,
   Commits oder Tickets schreiben; die Meldung des Skripts nennt nur Namen.
3. Den Lauf wiederholen (fehlgeschlagenen Job `deploy` neu starten, oder den
   [Notfall-Deploy](#notfall-deploy) mit dem Stand). Erwartet im Log:
   „Pflicht-Stack-Variablen vollständig." und danach beide Stufen.
4. Wie [nach jedem Deploy](#nach-jedem-deploy); `support_mail` in
   `/api/status` zeigt nach dem nächsten Abruf (spätestens zwei Minuten)
   wieder `ok`.

Der **Probelauf** des Notfall-Deploys prüft dieselbe Liste und wird bei einer
fehlenden Variablen rot — ein schneller Weg, den Stand ohne Änderung zu
prüfen.

**Ohne Deploy bemerken:** `support_mail` in `/api/status` meldet
`nicht_eingerichtet` (Zugänge fehlen im laufenden Container) oder `veraltet`
(letzter erfolgreicher Abruf über 30 Minuten her); die Seite „Betrieb" zeigt
dann unter dem Urteil den Kasten „Support-Mail" mit Postfach, letztem Abruf
und letztem Fehler. `veraltet` mit einem Anmeldefehler heißt meist ein
geändertes Passwort, ohne Fehler eher, dass kein Cron-Leader läuft
(`checks.cron_leader`).

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
   kein Fehler aus der Gegenprobe auf die übrigen Dienste, „update_stack
   wurde NICHT aufgerufen". Ohne
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
