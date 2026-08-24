# Handoff — Stand 25.08.2026, nachts

Alles Beschriebene ist auf `main` und gepusht. **33 Commits** seit dem letzten
Handoff (78e618c0).

Das laufende Register der offenen Punkte steht in **`BAUSTELLEN.md`** — dort
auch die Arbeitsregel, auf die Simon Wert legt: prüfen statt glauben, mit
Tests härten samt Gegenprobe, und **erst nach Ausrollen und Nachmessen
abhaken**. Ein Punkt verschwindet nie, er wandert zu den Erledigten.

Nächste Schritte in dieser Reihenfolge, so von Simon festgelegt:
**zwei Agenten durchziehen → TestFlight → neue Sammelrunde.**

---

## 1. Zuerst: die zwei abgestürzten Agenten neu starten

Beide sind gegen Ende der letzten Sitzung an einem Infrastrukturproblem
gestorben ("no progress for 600s"), nicht an ihrer Aufgabe.

### a) Live-Aktualisierung vollständig prüfen — noch ohne jedes Ergebnis

Simons Auftrag wörtlich: *"Socket.io soll alle Socket-Verbindungen und
Webhooks prüfen. Damit die App immer live aktuell ist bei allen!"*

Es geht um **Vollständigkeit**: Wenn irgendwo etwas passiert, müssen es alle
Beteiligten sofort sehen — ohne Neuladen, in allen drei Rollen.

Vorgehen für den neuen Anlauf:
1. Bestandsaufnahme über `backend/utils/liveUpdate.js` und alle Aufrufstellen
   (`grep -rn "liveUpdate\." backend/`).
2. Die Vorgänge durchgehen, bei denen mehrere Menschen dasselbe sehen:
   Termine (anlegen, absagen, Warteliste, Anwesenheit, QR-Check-in), Anträge
   (sieht die Leitung ihn sofort? sieht die Konfi die Bestätigung sofort?),
   Punkte, Level, Abzeichen, Challenges, Verwaltung.
3. **Lücken entstehen meist bei den EMPFÄNGERN**, nicht beim Senden. Ein
   Ereignis, das nur an die Leitung geht, aber Teamer:innen betrifft, ist eine
   Lücke — und die drei Komponentenbäume verarbeiten Ereignisse womöglich
   unterschiedlich.
4. **Wichtiger Verdacht:** Am 24.08. kam eine Doppelabfrage-Bremse in
   `frontend/src/services/useOfflineQuery.ts` (`53e45f27`, In-flight-Dedupe
   plus Frische-Drossel). Die könnte Live-Ereignisse verschlucken: Wenn ein
   Ereignis ein Neuladen auslöst, die Drossel es aber als "zu frisch" abweist,
   sieht niemand die Änderung. **Das wäre eine frische Regression und ist
   vorrangig zu prüfen.**
5. Webhooks: Prüfen, ob es überhaupt welche gibt. Wenn nicht, klar sagen.

### b) Abzeichen-Bedingungen zu Ende prüfen

Der erste Anlauf hat zwei Befunde geliefert, die gerettet und committet sind
(`9d3eeeb3`, siehe unten). **Nicht abgeschlossen** war der systematische
Durchgang durch ALLE Bedingungstypen und die Frage, was überflüssig in der
Datenbank liegt.

Startpunkte: `docs/wissen/abzeichen.md` (alle Typen, 13 frühere Befunde) und
`backend/routes/badges.js` (`checkAndAwardBadges`, ab ca. Zeile 104).

Offene Fragen: Funktioniert jeder Typ? Gibt es in Produktion Abzeichen, die
durch die **Namenskopplung** tot sind (`specific_activity`,
`activity_combination`, `category_activities` speichern NAMEN — wird eine
Aktivität umbenannt, wird das Abzeichen still unerreichbar)?

---

## 2. Dann TestFlight

**Build 140 ist draußen, hat aber den Multi-Org-Push NICHT** — er wurde davor
gebaut. Der nächste Build braucht also `iosBuildNumber` 141 in
`frontend/version.json`.

Regeln: nur auf Zuruf dispatchen, Commit nennen, Testinfos sind Pflicht (mit
Klickpfad und Erwartet-Zeile, per ASC-API). `frontend/scripts/apply-version.sh`
wird von der CI selbst aufgerufen.

---

## Was in dieser Sitzung entstanden ist

### Der Umzug ist durch
Konfi Quest läuft wieder auf **server.godsapp.de**. Datenbank vollständig
übertragen (alle 57 Tabellen deckungsgleich geprüft, nicht stichprobenartig),
Uploads (151 MB, alle 48 Antragsfotos und 14 Chat-Dateien gegengeprüft), DNS
umgestellt, TLS gültig bis Oktober.

Der Fahrtenbuch-Server bleibt als **Rückfallebene**: Er reicht Aufrufe
transparent durch (wer noch die alte IP im Cache hat, merkt nichts) und holt
sich nächtlich um 3:30 Datenbank, Uploads und Image-Tag. Anleitung für den
Ernstfall: `/opt/konfi-quest/NOTFALL.md` auf dem Server.

**Staging ist ersatzlos entfernt** — Stack, Verzeichnis, Domain, Images,
Build-Workflow. Es war seit dem Notumzug ohnehin tot (die Domain zeigte auf
einen Server, auf dem es den Stack nie gab).

### Ernste Funde
- **Verschwindende Nachrichten: vier echte Verlustwege** (`5932c9a2`). Der
  schlimmste: Im `writeQueue` stand `if (item.metadata.type === 'chat')
  continue;` — kein Fehlerhinweis, weil "die Blase zeigt es ja". Nach einem
  Neustart war die Blase weg und die Nachricht **spurlos verschwunden**. Dazu:
  Sendefehler nur im Arbeitsspeicher, kein Nachsenden beim Kaltstart, und der
  Org-Wechsel leerte die Warteschlange kommentarlos (Nachrichten hätten unter
  fremdem Konto rausgehen können). 26 Tests mit Gegenprobe.
  *Grenze bleibt:* Absturz exakt während des ersten Sendeversuchs.
- **Socket blieb nach Sitzungsablauf angemeldet** (`cda3d1f5`). Beim bewussten
  Abmelden war alles dicht — aber wenn die Anmeldung von selbst ablief, blieb
  die Verbindung serverseitig als die abgemeldete Person bestehen. Die nächste
  Person am selben Gerät bekam den alten Socket samt Räumen.
- **98 API-Pfade zeigten auf falsche Adressen** (`b5d76109`). Drei von fünf
  YAML-Dateien setzten `/api` in die Serveradresse, zwei in den Pfad; beim
  Zusammenführen gewann eine Variante. Gegen die echte API geprüft: alte
  Adresse 405, korrigierte 400.
- **Abzeichen mit Wert 0 hätten sofort für alle ausgelöst** (`9d3eeeb3`) —
  `x >= null` ist in JavaScript wahr. In Produktion aktuell kein solcher Fall.
- **`/organizations/current` brauchte 189 ms** (`bde959a3`): fünf unverbundene
  Joins bildeten ein Kreuzprodukt mit 77.376 Zwischenzeilen. Nach dem Umbau
  **0,95 ms**, gemessen mit EXPLAIN ANALYZE gegen Produktionsdaten.
- **Zwei Dashboard-Schalter waren wirkungslos** (`03a20a09`, `3439e9ed`):
  `dashboard_show_challenges` kam im Backend gar nicht vor, der
  Konfispruch-Schalter wurde serverseitig ignoriert.
- **Zwei Falschaussagen im Handbuch**: Es behauptete, die Leitung könne fremde
  Zweiergespräche lesen (seit 23.08. ausdrücklich nicht) und die
  Ablehnungs-Begründung sei freiwillig (ist Pflicht).
- **Der Handbuch-Renderer konnte keine nummerierten Listen** — alle
  Schritt-Anleitungen wurden seit jeher zu einem Absatz zusammengezogen.

### Challenges (Simons Sammlung)
Abzeichen erst nach Freigabe (`3443df5b`, **gleiche Regel für alle**, im Code
als Absicht kommentiert), sauberer Feed (Feed/Wartet/Ausgeblendet),
nachträgliches Anonymisieren war serverseitig auf "Konfi entscheidet"
beschränkt — daher fehlte es im Teamer-Event; optionale Begründung beim
Ausblenden; Links nur noch von Musikdiensten mit Titel und Interpret
(`4bf2b7d7`); Entwürfe unter "Geplant" ohne Datumszwang (`f3d06c29`);
Beschriftungen und Grammatik (`99d0ba4e`).

### Website und Handbuch
Handbuch verlinkt (Navigation, Fließtext, Mobil-Symbol) und aus dem Handbuch
ein Verweis zur API-Referenz. **Die Navigation der Startseite war kaputt** —
das Logo klebte am ersten Menüpunkt, die Knöpfe brachen zweizeilig um; behoben,
"Warum" ist dafür aus der Leiste geflogen (`7561d331`). Handbuch-Navigation
auf dem Handy: **449 px auf 53 px**, jetzt einklappbar und mitlaufend
(`debc8af3`). Wiki-Querverweise samt Build-Abbruch bei toten Links
(`623c0f96`).

### Sicherheit
CodeQL: 6 Meldungen geprüft, **eine echt** — die Doku-Anmeldung hatte kein
Rate-Limit (`9e665197`, jetzt 20 Fehlversuche/15 min). Fünf begründet als
Fehlalarm geschlossen. Dependabot: null offene Meldungen.

---

## Offen (Auszug — vollständig in BAUSTELLEN.md)

**Vor 2.0.0:**
- Live-Aktualisierung prüfen (siehe oben, vorrangig)
- Abzeichen-Bedingungen zu Ende prüfen
- Handbuch mit Bildschirmfotos
- Store-Texte (157 Changelog-Einträge sind für Nutzer:innen zu viel)
- Bildschirmfotos aus Org 4 (als Skript, damit sie nicht veralten)
- Version, Git-Tag, GitHub-Release (Tag ohne `v`-Präfix)

**Bewusst nach 2.0.0:**
- **Das 3-MB-Bundle aufteilen** (697 kB gepackt, ein Monolith). Größter Hebel
  für den Kaltstart im Web (geschätzt auf 400–450 kB je Rolle), aber der Umbau
  fasst die Wurzel des Routings an und trifft damit jede Nutzerin; nachladbare
  Teile brechen typischerweise erst im Betrieb bei schlechtem Netz. Nutzen
  einmalig (danach Cache, nativ ohnehin im Paket), Fehler dauerhaft.

**Bekannter Fehler, Ursache belegt, Fix offen:**
- Testläufe brechen sporadisch ab (etwa jeder vierte). `backend/database.js`
  ruft beim Modul-Laden `process.exit(1)`, wenn die Datenbank nicht sofort
  antwortet; `utils/liveUpdate.js` lädt dieses Produktions-Singleton und
  öffnet einen zweiten Pool. Fix: den Pool übergeben statt ihn zu holen.
  Eine zweite Spur (Transportebene der Testverbindungen) ist offen.

---

## Zugänge und Testkonten

- **Demo-Gemeinde (Org 4)**, Passwort überall `KonfiDemo2026!`:
  `demo.leitung` (Pastorin Kathrin Möller), `demo.teamer` (Lasse Brandt),
  `demo.emilia` bis `demo.malte` (Konfis).
  **Nicht anfassen:** `review-*` und `google-test-*` — bei Apple und Google
  für die App-Prüfung hinterlegt.
- **API-Doku:** https://konfi-quest.de/docs/api/ — Passwort in
  `~/.claude/secrets.env` als `KONFI_QUEST_DOCS_PASSWORD`.
- **Handbuch:** https://konfi-quest.de/docs/ — offen.
- **Server:** `ssh root@server.godsapp.de`, Stack über Portainer 249
  (`/opt/stacks/portainer/compose/249/v220/docker-compose.yml`).
  Deploy: Image-Tags per sed ersetzen, `docker compose -p konfi_quest pull`
  und `up -d`. Backup vorher nicht vergessen (`/opt/Konfi-Quest/dump/`).

---

## Fallen, die diese Sitzung gekostet haben

- **API-Pfade nie raten.** Es gibt eine vollständige OpenAPI-Doku in
  `docs/api/*.yaml`. Ich habe viermal geraten und viermal 404 bekommen — der
  Mountpunkt weicht oft vom Dateinamen ab (`routes/activities.js` hängt unter
  `/api/admin/activities`).
- **An vHosts nur über die KeyHelp-API arbeiten.** Ein `mv` auf eine
  Custom-vHost-Datei machte die Apache-Konfiguration ungültig — beim nächsten
  Neustart wäre die Seite ausgefallen. Die API räumt sauber selbst auf.
- **Nicht zu viele Agenten gleichzeitig.** Bei acht parallel kam es zu
  Git-Kollisionen: Ein Commit trägt Dateien, die nicht zu seiner Beschreibung
  passen (`623c0f96`). Nichts ging verloren, aber die Historie ist unsauber.
  Künftig strikt nach Dateien aufteilen, nicht nach Themen.
- **Agentenbefunde bleiben Behauptungen.** Zwei Beispiele aus dieser Sitzung:
  Ein Agent meldete ein "echtes Produktivkonto" im Browser — es war ein
  Demo-Konto. Ein anderer meldete zwei Payloads ohne `organization_id` — die
  wurde zentral ergänzt. Beides fiel beim Nachprüfen auf.
- **Im richtigen Modus messen.** Der springende Large-Title existiert nur im
  iOS-Modus; meine erste Messung lief im Android-Modus und wäre wertlos
  gewesen.
- **Horizontaler Seitenüberlauf ist nicht dasselbe wie Überlauf in einer
  Leiste.** Ich hielt die Startseiten-Navigation für in Ordnung, weil die
  Seite nicht seitlich scrollte — sie brach aber innerhalb der Leiste um.
