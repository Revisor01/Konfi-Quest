# Handoff — Stand 24.08.2026

Übergabe an die nächste Sitzung. Alles unten Beschriebene ist auf `main` und
gepusht. **Achtung: noch NICHT deployt** — Produktion läuft auf `d7a5639`,
`main` steht auf `88aa4ba1`, acht Commits dazwischen.

## Sofort zu tun

### 1. CI prüfen und deployen

Der letzte CI-Lauf (`88aa4ba1`) war beim Übergeben noch nicht durch. Erst
prüfen, dann ausrollen:

```
gh run list --limit 1
cd /opt/konfi-quest
sed -i 's|konfi-quest-backend:[a-f0-9]\{7\}|konfi-quest-backend:<SHA>|; s|konfi-quest-frontend:[a-f0-9]\{7\}|konfi-quest-frontend:<SHA>|' docker-compose.yml
docker compose pull backend frontend && docker compose up -d
curl -sS http://127.0.0.1:5055/api/status
```

**Zwei Sicherheitsfixes hängen daran** und wirken erst nach dem Deploy:
- Fremde Zweiergespräche im Chat (auch der Live-Kanal)
- Punktestand fremder Konfis über `/api/levels/konfi/:id`

### 2. Nach dem Deploy: gegen Produktion prüfen

Nicht nur den Statuscode ansehen — die Regeln selbst messen. Muster aus den
letzten Sitzungen:

```
ssh root@kkd-fahrtenbuch.de 'docker exec kq-backend node -e "
const jwt=require(\"jsonwebtoken\");const http=require(\"http\");
const t=jwt.sign({id:85,type:\"konfi\"},process.env.JWT_SECRET,{expiresIn:\"3m\"});
http.get({host:\"127.0.0.1\",port:5000,path:\"/api/levels/konfi/92\",
  headers:{Authorization:\"Bearer \"+t}},r=>console.log(r.statusCode));"'
```
Erwartet: **403** (vorher 200 mit Namen und Punktzahl).

---

## Offen — das Wichtigste zuerst

### A) Punkteziel 0: die Analyse ist NICHT fertig

**Simons Auftrag: das braucht eine richtig saubere Analyse.** Eine erste
Untersuchung gab es, sie hat aber nur einen Teil beleuchtet — nämlich die
Anzeige. Was in den **Modals** passiert, ist offen.

#### Was bisher belegt ist

Zwei Dinge werden leicht verwechselt und müssen getrennt bleiben:

| | Feld | Was es tut |
|---|---|---|
| **Ziel** | `target_gottesdienst` / `target_gemeinde` | eine Zahl, rein für Ringe und Fortschritt |
| **Schalter** | `gottesdienst_enabled` / `gemeinde_enabled` | der eigentliche Aus-Knopf |

Zum **Ziel 0** (belegt):
- Backend nimmt 0 an (`jahrgaenge.js:20-21`, `isInt({min: 0})`)
- Der Schieberegler beginnt bei 1 — über die App kommt niemand auf 0
- Fast jede lesende Stelle koerziert mit `|| 10`, und `0 || 10` ergibt 10.
  Zentral in `konfi.js:268-269` — die Konfi-App bekommt eine 0 gar nicht zu
  sehen
- `ActivityRings.tsx:50-52` hat einen expliziten Guard, keine Division durch 0
- Ausnahme: Die Jahrgänge-Liste nutzt `?? 10` und zeigt ehrlich „Ziel 0"

Zum **Schalter** wurde am 24.08. eine Lücke geschlossen: Beide zugleich
abzuschalten war per API möglich (jetzt 400). Die Sperre gab es nur in der
Oberfläche.

#### Was NICHT untersucht ist — hier weitermachen

**Simons Frage: „Was passiert denn dann in den Modals mit Typ etc.?"**

Diese Dateien wurden nicht geprüft:

```
frontend/src/components/admin/modals/BonusModal.tsx
frontend/src/components/admin/modals/ActivityManagementModal.tsx
frontend/src/components/admin/modals/ActivityModal.tsx
frontend/src/components/admin/modals/ActivityRequestModal.tsx
frontend/src/components/admin/modals/EventFormSections.tsx
frontend/src/components/admin/modals/BadgeManagementModal.tsx
frontend/src/components/konfi/modals/ActivityRequestModal.tsx
frontend/src/components/konfi/modals/RequestDetailModal.tsx
frontend/src/components/konfi/modals/PointsHistoryModal.tsx
```

Konkrete Fragen, die zu beantworten sind:

1. **Typ-Auswahl in den Modals.** Fast überall gibt es „Gottesdienst" oder
   „Gemeinde" zur Wahl (Aktivität anlegen, Bonuspunkte, Event-Punkte,
   Badge-Kriterium). Wird eine **abgeschaltete** Punktart dort noch angeboten?
   Wenn ja: Man wählt sie, speichert — und der Server lehnt mit
   `pointTypeGuard` ab. Verständliche Meldung oder stummer Fehler?
2. **Bonuspunkte** (`BonusModal`): Der Typ ist Pflicht. Was passiert, wenn
   beide Arten aus wären? (Seit dem 24.08. nicht mehr erreichbar, aber
   Altbestände könnten existieren — **prüfen**, ob es solche Jahrgänge gibt.)
3. **Event anlegen** (`EventFormSections`): `point_type` hat Default
   `gemeinde`. Was, wenn Gemeinde im Zieljahrgang aus ist? Wird beim Anlegen
   gewarnt, oder fällt es erst beim Verbuchen auf?
4. **Badge-Kriterien**: „Gesamtpunkte", „Gottesdienst-Punkte" usw. werden bei
   abgeschalteter Art nie erfüllt. Sieht die Leitung das beim Anlegen?
5. **Ziel 0 in den Modals**: Taucht das Ziel dort überhaupt auf? Gibt es eine
   Fortschrittsanzeige, die durch 0 teilt?
6. **Ein Jahrgang, zwei Zustände**: Was, wenn ein Konfi in einen Jahrgang
   **wechselt**, in dem eine Punktart aus ist, aber Punkte dieser Art hat?
   (Der Wechsel nimmt Punkte mit — `konfi-management.js:287`.)

**Methode, die sich bewährt hat:** Erst am Code belegen, dann gegen Produktion
messen. Prüfen, ob es solche Jahrgänge überhaupt gibt:

```sql
SELECT id, name, organization_id, gottesdienst_enabled, gemeinde_enabled,
       target_gottesdienst, target_gemeinde
FROM jahrgaenge
WHERE NOT gottesdienst_enabled OR NOT gemeinde_enabled
   OR target_gottesdienst = 0 OR target_gemeinde = 0;
```

### B) Screenshots für die Knowledge Base

**Simons Wunsch: Bilder in jeder Sektion.** Entschieden ist:
- Screenshots aus der **Testgemeinde Org 4**, nicht aus Org 1 — dort stehen
  echte Konfi-Namen, und `/docs` ist öffentlich erreichbar
- Als **Skript** (`scripts/build-screenshots.mjs`), damit sie nach einem
  UI-Umbau neu erzeugt werden können statt still zu veralten

**Simons Anweisung wörtlich:** „Lege die Konten an, fülle alles mit Daten, pass
es so an, dass es echt aussieht."

Also: Org 4 mit glaubwürdigen Testdaten füllen (Konfis, Termine, Aktivitäten,
Challenges — dort sind aktuell **0**), Passwörter für `review-admin`,
`review-teamer`, `review-konfi` setzen und dokumentieren.

**Was schon funktioniert** (in dieser Sitzung erprobt):
- Login über Playwright gegen `https://konfi-quest.de/login` klappt
- `page.goto` braucht `waitUntil: 'domcontentloaded'` — mit `networkidle`
  läuft es in einen Timeout
- Der Anmelde-Knopf: `page.locator('ion-button').first()` — `getByText`
  kollidiert mit der Überschrift
- **Die Einführung überlagert das Dashboard** und muss weggeklickt werden
  („ÜBERSPRINGEN"), sonst zeigt jeder Screenshot nur den Onboarding-Dialog

Bestehende Konten in Org 4: `review-admin` (org_admin), `review-teamer`,
`review-konfi`, dazu `google-test-*`.

### C) Build 140

Sammelt alles seit Build 139 ein — inzwischen **über 20 Commits**. Simons
Beobachtungen zum „Was ist neu"-Banner kamen daher, dass Build 139 vom Stand
`bc4168a8` ist.

**Regel:** Nur auf Zuruf dispatchen, und beim Bauen den Commit nennen.

### D) Kleinere offene Punkte

- **Handbuch mobil**: Bei 12 Kapiteln sind die Chips in der Navigation grenzwertig
  viele. Ab etwa 14 braucht es eine andere Lösung (ein Ausklapp-Element ist
  **nicht** die Antwort — siehe „Fallen" unten).
- **Doku-Format uneinheitlich**: `konfis-events.yaml` und `teamer-material.yaml`
  schreiben Pfade **mit** `/api`-Präfix, die anderen drei ohne. In der
  zusammengeführten `openapi.json` stehen beide Formen nebeneinander.
- **`/docs/api` ist ungeschützt.** Die Berechtigungsmatrix ist eine Landkarte
  für jeden, der Lücken sucht. Caddy kann `basic_auth`; im Block
  `konfi-quest.de` ergänzen:
  ```
  @apidocs path /docs/api /docs/api/*
  basic_auth @apidocs { simon <bcrypt-hash> }
  ```
  Hash mit `caddy hash-password`.

---

## Was am 23./24.08. entstanden ist

### Knowledge Base: 12 Kapitel unter /docs

Quellen als Markdown in `docs/handbuch/`, `scripts/build-handbuch.mjs` baut
daraus die Seite. Kapitel: Überblick, Konfis, Teamer:innen, Leitung,
Passwörter, Punkte/Level, Jahrgänge/Kategorien, Abzeichen, Termine,
Challenges, Chat, Wrapped.

Anspruch (Simon): „Für alle Deppen volle Erklärungen, jede Option, welche
Folge." Entsprechend ist jede Formularoption einzeln beschrieben — was sie
bewirkt, was dadurch wegfällt, was sich hinterher nicht mehr ändern lässt.

### API-Doku: 238 Operationen, Lücke null

Von 133 auf 238. Swagger UI unter `/docs/api/swagger.html`, daneben die
kompakte Übersicht wie bisher. `scripts/build-openapi.mjs` führt die fünf
YAML-Dateien zusammen und bricht ab, wenn eine Operation doppelt vorkommt.

Swagger liegt **lokal** (`docs/api/swagger/`, 1,8 MB), nicht per CDN. Das
Ausprobieren gegen Produktion ist abgeschaltet — echte Daten echter Gemeinden.

### Sicherheitsbefunde, alle behoben

1. **Fremde Chats live mitlesbar** (23.08.): Die Socket-Verbindung prüfte nur
   die Gemeinde. In Org 1 hätten 21 Konfis jedem Chat beitreten können.
2. **Anonyme Umfragen waren nicht anonym** (23.08.): Der Name fehlte, die
   Kennung kam mit. Betraf eine laufende Umfrage mit sechs Stimmen.
3. **Private Zweiergespräche** (23.08.): Die Leitung konnte jedes fremde
   Zwiegespräch lesen und exportieren.
4. **Socket-Nachtrag** (24.08.): Fix 3 griff nur für die Historie, der
   Live-Kanal blieb offen. **Beim Beheben fiel auf: Die Query las den Raumtyp
   gar nicht mit** — der erste Fix wäre wirkungslos geblieben.
5. **Punktestand fremder Konfis** (24.08.): Über `/api/levels/konfi/:id` konnte
   jeder Konfi Namen, Punktzahl und Level jedes anderen abrufen. Gegen
   Produktion nachgewiesen (Konfi 85 → Konfi 92, Status 200).
6. **Ablehnung ohne Begründung** (24.08.): Nur im Frontend Pflicht.
7. **Beide Punktarten abschaltbar** (24.08.): Sperre nur in der Oberfläche.

### Bedienung

- Tab „Events" heißt jetzt **„Mitmachen"** (alle drei Ansichten)
- Challenges-Doppelung unter „Mehr" entfernt
- Archiv steht vor den Abzeichen (Leitung **und** Konfi)
- Uhr statt Flagge bei „Geplant"
- Leere Karte „Status" beim Teamer-Anlegen ausgeblendet
- Einstellung „Chat-Berechtigungen" entfernt (war unerreichbar und wirkungslos)
- **Abgelehnte Anträge blockieren das Löschen einer Aktivität nicht mehr** und
  lassen sich einzeln löschen (Simons Fall: vier betroffene Aktivitäten)
- **Abzeichen-Bedingungen „Spezifische Aktivität" und „Aktivitäts-Kombination"
  waren wirkungslos** — das Formular speicherte die ID, die Auswertung liest
  den Namen. Sieben Badges in Produktion konnten nie vergeben werden.
  **Bestehende einmal öffnen und neu speichern, dann greifen sie.**

---

## Server

Konfi Quest läuft weiterhin übergangsweise auf dem Fahrtenbuch-Server:

- SSH: `ssh root@kkd-fahrtenbuch.de` (185.248.143.234)
- Stack: `/opt/konfi-quest/docker-compose.yml`
- Container: `kq-backend`, `kq-frontend`, `kq-postgres`
- Backups: `/opt/konfi-quest/dump/`

**Deploy läuft NICHT über die CI.** Der `deploy`-Job ist pausiert
(`if: false && ...`), weil er auf den toten Portainer-Stack 249 zeigt.

Vor einem Deploy mit Datenbankbezug sichern:
```
docker exec kq-postgres pg_dump -U konfi_user konfi_db | gzip > dump/vor-<sha>-$(date +%Y%m%d-%H%M%S).sql.gz
```

## Tageslosung — Notbetrieb

`ketiv.de` liegt auf dem gesperrten Server. Die Losungen-API läuft ersatzweise
unter `/opt/ketiv/docker-compose.notbetrieb.yml` (`ketiv-api`,
`ketiv-postgres`), zusätzlich im Netz `konfi-quest_internal`. **Wird dieses
Netz neu angelegt, muss der ketiv-Stack neu verbunden werden.**

Noch offen: Der Losungs-API-Key steht im Klartext im Backend-Log, weil er als
Query-Parameter in der URL steht.

---

## Fallen, die schon Zeit gekostet haben

- **Backend-Tests laufen lokal nicht** — kein Docker auf dem Mac. Nur über CI.
- **`generateToken()` will den Seed-Schlüssel, nicht den Benutzernamen.**
  `generateToken('orgAdmin1')`, nicht `'orgadmin1'`. Bei falscher Angabe wirft
  der Helfer, und **alle** Tests des Blocks scheitern — auch die Positiv-Fälle.
  Das sah nach einem Code-Fehler aus, war aber der Test.
- **Ein `200` beweist keine Berechtigung.** `POST /chat/direct` antwortet bei
  einem schon vorhandenen Raum ebenfalls mit 200. Bei Berechtigungstests
  zusätzlich `created: true` prüfen oder einen Partner ohne bestehenden Raum
  wählen.
- **Doku-Generatoren dürfen kein `new Date()` nutzen.** Der CI-Frischecheck
  baut neu und vergleicht per `git diff` — bei Tageswechsel wäre er ohne
  Zutun rot geworden. Datum kommt jetzt aus dem letzten git-Commit der Quellen.
- **`<details>` ohne `open` versteckt auch auf dem Desktop.** Der Versuch, die
  mobile Navigation einklappbar zu machen, machte sie auf **beiden** Breiten
  unsichtbar. Umbrechende Chips waren die Lösung.
- **nginx leitet Verzeichnisse absolut um** — `/docs` ging auf `http://`.
  `absolute_redirect off` behebt das.
- **Agenten-Befunde sind Behauptungen.** In dieser Sitzung meldete ein Agent,
  die 2-Tage-Abmeldefrist sei nur im Frontend. Sie steht auch serverseitig
  (`konfi.js:1718`) — er hatte die falsche Route geprüft. Umgekehrt haben
  Agenten vier meiner eigenen Vorgaben zu Recht zurückgewiesen.
- **Drei Ansichten heißt drei Stellen.** Gilt unverändert. Die
  Archiv-Reihenfolge musste in Leitungs- und Konfi-Ansicht getrennt korrigiert
  werden.
- **Beim Bauen den Commit nennen.** Build 138 wurde gestartet, bevor sieben
  gewünschte Änderungen entstanden.
- **Apple braucht länger als eine Stunde.** `UPLOAD SUCCEEDED` im Log ist das
  verlässliche Signal, nicht die Build-Liste.

## Regeln aus dieser Sitzung

- **Vor dem Ändern messen.** Vor der Jahrgangs-Regel wurde gerechnet, ob
  jemand ausgesperrt würde (Ergebnis: jeder Konfi behält mindestens einen
  Kontakt). Vor dem Direktchat-Schutz, welche Chats betroffen sind (zwei).
- **Ein Fix ohne Gegenprobe ist kein Fix.** Beim Socket-Nachtrag las die Query
  den Raumtyp nicht mit — ohne Nachsehen wäre die Änderung wirkungslos
  geblieben und hätte falsche Sicherheit vorgetäuscht.
- **Bei Sicherheitsfixes gegen Produktion messen**, nicht nur gegen Tests.
