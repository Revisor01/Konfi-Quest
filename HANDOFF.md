# Handoff — Stand 24.08.2026, abends

Alles Beschriebene ist auf `main` und gepusht. **Produktion hinkt vier Commits
hinterher**: live läuft `e18bdad`, `main` steht auf `3e59d9c1`.

Nächste Schritte in dieser Reihenfolge, so von Simon festgelegt:
**deployen → TestFlight → Rückzug auf den alten Server samt Datenbank.**

---

## 1. Sofort: deployen

Der CI-Lauf für `3e59d9c1` war beim Übergeben noch nicht durch. Erst prüfen:

```
gh run list --workflow="CI Pipeline" --limit 1
```

Dann ausrollen (Backup nicht vergessen, der Compose-Stand trägt bereits
`DOCS_PASSWORD`):

```
ssh root@kkd-fahrtenbuch.de
cd /opt/konfi-quest
docker exec kq-postgres pg_dump -U konfi_user konfi_db | gzip > dump/vor-<SHA>-$(date +%Y%m%d-%H%M%S).sql.gz
sed -i 's|konfi-quest-backend:[a-f0-9]\{7\}|konfi-quest-backend:<SHA>|; s|konfi-quest-frontend:[a-f0-9]\{7\}|konfi-quest-frontend:<SHA>|' docker-compose.yml
docker compose pull backend frontend && docker compose up -d backend frontend
curl -sS http://127.0.0.1:5055/api/status
```

**Danach zwingend prüfen** — die Anmeldung für die API-Doku ist neu und kann
einen aussperren:

```
curl -sS -o /dev/null -w "%{http_code}\n" https://konfi-quest.de/docs/api/          # 302 erwartet
curl -sS -o /dev/null -w "%{http_code}\n" https://konfi-quest.de/docs/api/login.html # 200 erwartet
curl -sS -o /dev/null -w "%{http_code}\n" https://konfi-quest.de/docs/              # 200, Handbuch bleibt offen
```

Fällt die Anmeldung aus, liegt in `/etc/caddy/Caddyfile.bak-vor-docslogin-*`
der Stand mit Basic-Auth.

---

## 2. TestFlight (Build 140)

Erst nach dem Deploy. Build 139 ist von `bc4168a8` — inzwischen über 30 Commits
alt, was heute getestet würde, wäre nicht das, was ausgeliefert wird.

**Regeln:** nur auf Zuruf dispatchen, beim Bauen den Commit nennen, und die
Testinfos ("Was ist neu") sind Pflicht — mit Klickpfad und Erwartet-Zeile.
Version steht überall noch auf 1.5.3; `frontend/scripts/apply-version.sh` setzt
sie zuverlässig (der alte Fehler ist behoben und auf `main`).

---

## 3. Rückzug auf den alten Server

Der Abuse-Fall ist erledigt, der ursprüngliche Server wieder frei. Konfi Quest
läuft aktuell übergangsweise auf dem Fahrtenbuch-Server:

- SSH: `ssh root@kkd-fahrtenbuch.de` (185.248.143.234)
- Stack: `/opt/konfi-quest/docker-compose.yml`
- Container: `kq-backend`, `kq-frontend`, `kq-postgres`
- Daten: `/opt/konfi-quest/uploads`, `/opt/konfi-quest/push/`, Dumps in `dump/`

**Vor dem Umzug klären** (mit Simon):
- Ist der alte Server erreichbar, und in welchem Zustand?
- Soll die Tageslosung (`ketiv`) mit zurück oder im Notbetrieb bleiben?
  Sie läuft derzeit unter `/opt/ketiv/docker-compose.notbetrieb.yml`,
  zusätzlich im Netz `konfi-quest_internal` — wird dieses Netz neu angelegt,
  muss der ketiv-Stack neu verbunden werden.

**Was mitmuss:** Datenbank (pg_dump), `uploads/`, die Firebase-Datei unter
`push/`, die Umgebungsvariablen aus der Compose-Datei (darunter das neue
`DOCS_PASSWORD`), der Caddy-Block samt forward_auth für `/docs/api`, und die
DNS-Umstellung bei Netcup.

---

## Was heute entstanden ist (15 Commits)

### Sicherheit und Datenschutz
- **Event-Chat:** Wer sich abmeldet, verlässt ihn — galt vorher nur bei der
  Selbstabmeldung von Teamer:innen, nicht im Weg der Konfi-App und nicht beim
  Austragen durch die Leitung. Konfis lasen also weiter mit und konnten den
  Chat nicht einmal selbst verlassen.
- **Material** mit Jahrgang sehen nur noch dessen Teamer:innen; ohne Jahrgang
  alle, die Leitung immer. Vorher war die Zuordnung reine Suchhilfe.
- **Geheime Abzeichen** für Teamer:innen wurden mit Namen, Beschreibung und
  Fortschritt ausgeliefert, bevor sie verdient waren.
- **API-Doku** hinter einer Anmeldung (vorher öffentlich).

### Fehler, die Nutzer:innen trafen
- **Zwei Teamer:innen ließen sich gar nicht löschen** (Urkunden-Fremdschlüssel),
  ebenso jede Person, die je einen Termin angelegt hatte.
- **Pflichttermine:** Ein nachträglich ergänzter Jahrgang buchte niemanden nach;
  beim Jahrgangswechsel blieben die alten Termine stehen.
- **Abzeichen:** Pflicht-Anwesenheit war in der Konfi-Liste unsichtbar, die
  Statistik zählte Teamer-Abzeichen mit (56 statt 50 in Org 1), verdiente
  Abzeichen verschwanden beim Abschalten, die Teamer-Kombination zeigte 100 %
  ohne zu vergeben, der Hilfetext zu Bonuspunkten war falsch.
- **Android:** Der erste und letzte Reiter waren halb abgeschnitten
  (`safe-area-inset-left/right` kam im ganzen Projekt nicht vor). Die eigene
  letzte Nachricht zählte als ungelesen; die Zahl am App-Symbol wurde nie auf
  null zurückgenommen.
- **Aktivität zuweisen:** Bei einer Ablehnung des Servers blieb das Fenster
  wortlos stehen (`setError` war gar nicht geholt).
- **Chat-Zugriff:** Mehr-Organisations-Leitungen kamen nach einem Wechsel in
  keinen Chat der zweiten Gemeinde — der pg-Treiber liefert `bigint` als String,
  die Socket-Anmeldung setzte eine Zahl.

### Leistung
- Der Hintergrunddienst hätte bei 1000 Konfis **63 % Dauerlast** erzeugt
  (24 Abfragen und 95–292 ms pro Person, alle 5 Minuten). Jetzt getrennt: der
  App-Zähler läuft weiter alle 5 Minuten und kostet 2 Abfragen und 140 ms
  **unabhängig von der Personenzahl**; die Abzeichen-Prüfung läuft stündlich,
  weil ihre Kriterien an Wochen und Jahren hängen. Bei 1000 Personen: 5,3 %.
- Die Prüfung lief zuvor nur für Leute mit Push-Token — 41 von 82.

### Doku
- **Handbuch neu gebaut:** ein Kapitel je Seite statt 1171 Zeilen am Stück,
  durchnummeriert 1 bis 12, unten vor/zurück, davor eine Übersicht mit Karten.
- **Echte Umlaute** in 194 Quelldateien und allen fünf OpenAPI-Dateien.
- Zwei Wissensdokumente: `docs/wissen/abzeichen.md` (alle Bedingungstypen,
  13 Befunde) und `docs/wissen/zaehler.md`.
- Die Doku-Generatoren tragen kein Stand-Datum mehr — es kam aus dem letzten
  Commit der Quellen und konnte nie den Commit kennen, der es erzeugt; die CI
  wurde dadurch nach jeder Doku-Änderung grundlos rot.

### Daten
- **Demo-Gemeinde (Org 4)** gefüllt: 12 Konfis, 10 Termine, 4 Challenges mit
  Beiträgen in allen drei Sichtbarkeiten, Anträge in allen drei Zuständen.
  Konten `demo.emilia` bis `demo.malte`, Passwort `KonfiDemo2026!`.
  Die `review-*`-Konten wurden **nicht** angefasst (könnten beim App-Review
  hinterlegt sein).
- **Fünf leere Abzeichen in Org 1 eingestellt** (Tauferinnerung,
  Kasualien-Kenner, Freizeitguru, Adventskalender, Neujahrs-Starter), neue
  Aktivitäten `Adventsgottesdienst` und `Jahreswechsel-Gottesdienst`.
  `Lebensbegleiter` gelöscht (deckungsgleich mit Kasualien-Kenner).
  Alle fünf gegen Produktion gemessen, jeweils mit Gegenprobe.

---

## Offen

### Abzeichen: zwei bleiben leer
`Osterlachen` (40) und `Weihnachts-Insider` (41) haben weiter keine Bedingung
und sind damit unerreichbar — sie erscheinen aber nicht mehr unter
"erreichbar". Ostern ist fachlich komplex (Gründonnerstag, Karfreitag,
Ostersonntag, Ostermontag), Weihnachten hat Simon noch nicht entschieden.
Ebenfalls offen: `Kirchenjahr-Experte` (43) und `Undercover-Konfi` (50).

Für Undercover-Konfi wäre "Bestimmte Aktivität: Gottesdienstbesuch, Wert 8"
inhaltlich richtig, solange die Aktivität 1 Punkt gibt — ändert sich das, stimmt
das Abzeichen nicht mehr. Die Beschreibung müsste dann auf "8 Sonntags-
gottesdienste" lauten.

### Blinde Flecken — nie systematisch geprüft
- **Challenges** (der neueste und größte Bereich)
- **Wrapped**
- **Anwesenheit** und **Benachrichtigungen**

### Bekannt, bewusst liegengelassen
- **Namenskopplung bei Abzeichen:** `specific_activity`,
  `activity_combination` und `category_activities` speichern NAMEN. Wird eine
  Aktivität umbenannt, wird das Abzeichen still unerreichbar und der
  Fortschritt fällt auf null. Kein Hinweis im Editor. Ein Umbau, kein Fix.
- **Android-Zähler:** `aps.badge` wirkt nur auf iOS; Android kennt kein
  Betriebssystem-Abzeichen. Die Zahl kann dort nur die laufende App setzen,
  ein stiller Push weckt sie nicht. Vollständig lösen ließe sich das nur mit
  einer sichtbaren Benachrichtigung oder einem Hintergrunddienst — eine
  Produktentscheidung. Details in `docs/wissen/zaehler.md`.
- **Opt-out bei Pflichtterminen** lässt bewusst im Chat (Entscheidung Simon).
- Weitere Kleinbefunde: `docs/wissen/abzeichen.md`, Nummern 8 bis 13.

### Für 2.0.0 noch nötig
- Screenshots aus Org 4 (als Skript, damit sie nach einem UI-Umbau neu
  entstehen statt still zu veralten)
- Store-Texte: 157 Changelog-Einträge sind für Nutzer:innen zu viel
- Version setzen, Git-Tag, GitHub-Release (Tag-Schema ohne `v`-Präfix)

---

## Zugänge

- **API-Doku:** https://konfi-quest.de/docs/api/ — Passwort in
  `~/.claude/secrets.env` unter `KONFI_QUEST_DOCS_PASSWORD`, serverseitig als
  `DOCS_PASSWORD` in der Compose-Datei. Kein Benutzername mehr.
- **Handbuch:** https://konfi-quest.de/docs/ — offen
- **Demo-Gemeinde:** `demo.<vorname>` / `KonfiDemo2026!`

---

## Fallen, die heute Zeit gekostet haben

- **Der pg-Treiber liefert `bigint` als String.** Zweimal zugeschlagen: einmal
  im Chat-Zugriff (Produktionsfehler), einmal in meinem eigenen Testskript, wo
  `Number(r.id)` gegen ein String-Set nie traf und ein Abzeichen als "fehlend"
  erschien, das längst da war. Bei Vergleichen immer `Number()` auf beiden
  Seiten oder `String()`.
- **Ein Abzeichen kann vergeben werden und trotzdem unsichtbar sein.** Vergabe,
  Fortschrittsanzeige und Kategorienliste sind drei getrennte Codestellen. Wer
  nur eine prüft, hat nichts geprüft.
- **`criteria_type` und `criteria_extra` müssen zusammenpassen.**
  `specific_activity` will `required_activity_name`, `activity_combination`
  will `required_activities`. Passt es nicht, löst das Abzeichen nie aus — ohne
  jede Fehlermeldung. Ist mir beim Einstellen selbst passiert.
- **Agentenbefunde sind Behauptungen.** Von 13 Badge-Befunden waren zwei falsch
  (die Wertung erwartet keine IDs mehr; geheime Teamer-Abzeichen gibt es gar
  nicht), und der schwerste Befund — zehn Abzeichen mit leerer Bedingung — stand
  gar nicht im Bericht. Beim Zähler-Agenten war die Hauptthese widerlegbar.
- **Vor dem Behaupten messen.** "5 Sekunden sind unproblematisch" war voreilig;
  hochgerechnet auf 1000 Konfis waren es 63 % Dauerlast. Simons Nachfrage hat
  einen echten Fehler aufgedeckt.
- **Der Pfadfilter der CI kannte `scripts/` nicht.** Ein Commit nur an den
  Generatoren löste keinen Lauf aus — und ohne Lauf entstehen keine Images, der
  Deploy lief in `manifest unknown`. Behoben.
- **Backups vor jedem Schreibzugriff**, und Messungen gegen Produktion in einer
  Transaktion mit `ROLLBACK`. Hat heute mehrfach verhindert, dass Testdaten
  liegenbleiben.
