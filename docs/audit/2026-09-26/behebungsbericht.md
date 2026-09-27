# Behebungsbericht zum Release-Audit 2.3.0

Stand 27.09.2026, 11:30 UTC. Was seit der Gesamtabnahme vom 26.09. behoben wurde, was offen
bleibt und was bei Simon liegt. Jeder Punkt steht als Commit auf `claude/fervent-edison-wp5yfj`;
die Berichte je Bereich tragen an jedem Befund eine Status-Zeile mit Datum. Die Regeln für jede
Behebung standen im gemeinsamen Auftrag der Pakete: Test für den verbotenen und den erlaubten
Fall, Gegenprobe (Fix raus → Test rot), CHANGELOG, Handbuch und API-Doku im selben Commit,
Antwortformen unverändert (Store-Apps 2.2.x lesen weiter), Migrationen additiv.

## Kurzfassung

| | Vor dem Audit | Jetzt |
|---|---|---|
| Blocker der Gesamtabnahme | 7 | 1 offen (Apple-Schlüssel widerrufen — nur Simon) |
| Auflagen vor Release (Punkte 8–24) | 17 | 1 offen (Screenshots nach dem Deploy) |
| Backend-Tests | 139 Dateien / 3.399 | 169 Dateien / 3.700, grün |
| Frontend-Tests | 264 Dateien / 3.788 | 288 Dateien / 3.980, grün |
| Dunkelmodus, Textstellen unter 4,5:1 (94 Zustände) | 104 | 16 (alle: eigene Chat-Blase, in beiden Modi) |
| Formularfelder ohne Namen für die Vorlesefunktion | 170 von 186 | 0 |
| Klickbare Elemente ohne Tastaturbedienung | 147 | 0 |
| Commits auf dem Branch | — | 122 (17 Berichte, 105 Behebung und Nachweis) |
| Neue Migrationen | — | 160, 162–167 (alle additiv) |

Arbeitsweise: Die Koordination hat die fünf Blocker selbst behoben und danach 14 Pakete an
parallel arbeitende Agenten vergeben, jedes in einem eigenen Arbeitsbaum mit demselben Auftrag.
Jede Rückmeldung wurde gegen den Code geprüft, die Commits einzeln übernommen, nach jedem Paket
Typprüfung, Lint und die betroffenen Tests gefahren, zum Schluss beide Vollsuiten. Zwei Pakete
brachen am Sitzungslimit des Werkzeugs ab und wurden neu gestartet; ein Agent hat versehentlich
den Dev-Server eines anderen beendet — folgenlos, der Lauf wurde wiederholt.

## Was behoben wurde

### Sicherheit und Rechte

- **Super-Admin-Konten** konnte die Leitung einer Gemeinde, in der ein solches Konto zuhause ist,
  sperren, löschen oder ihnen ein Passwort setzen — und damit alle Gemeinden übernehmen. Jetzt nur
  noch durch Super-Admins (`0f2bd4db`; Sicherheit BF-01, Blocker).
- **Einladungen an Konfis** fremder Gemeinden waren möglich und verrieten zu jeder E-Mail-Adresse,
  ob ein Konto existiert. Konfis antworten jetzt wie unbekannte Kennungen (`1c953171`; BF-03,
  Blocker).
- **Direktchats** ließen sich über die Schnittstelle mit mehreren Konfis anlegen, unsichtbar für
  die Leitung; jetzt genau zu zweit, bestehende Räume werden per Migration 164 Gruppen
  (`40f16971`; Chat BF-01, Blocker).
- **Passwort-Reset-Grenze** zählte plattformweit (fünf Anfragen, egal von wem) und blockierte
  Unbeteiligte; jetzt je Absender und je E-Mail-Adresse, replica-übergreifend in der Datenbank
  (`5399fea4`, `0cac428e`; BF-05).
- **Klartext-Einmalpasswörter** in einer Altspalte werden per Migration 165 geleert (`3c25f9f6`;
  BF-06).
- **Soft-gelöschte Konten** (60 Tage nach Konfirmation) konnten sich weiter anmelden und chatten;
  Login, Refresh und Middleware weisen sie ab, laufende Sitzungen enden (`6c372445`; BF-07).
- **Refresh-Gnadenfrist**: der alte Schlüssel ließ sich fünf Minuten lang beliebig oft einlösen;
  jetzt genau einmal, ein weiterer Versuch widerruft alle Tokens des Kontos (Migration 166,
  `4f344907`; BF-08).
- **SMTP** prüft das Zertifikat des Mailservers; Host und Absender kommen nur noch aus der
  Umgebung, Betriebsadressen stehen nicht mehr im Repo (`ae73a289`, `9a7393ff`, `2086913e`,
  `fac0b361`; BF-09, BF-12).
- **Deaktivierung und Löschung** wirken sofort statt nach bis zu 30 s Rechte-Cache (`446d0107`;
  BF-10).
- **`X-Real-IP`** gilt nur noch vom eigenen Proxy (`0641c178`; BF-13, Rest über die
  gemeinsamen Limiter erledigt).
- **Fremde Gemeinde → 403/404** für 21 Routen mit 40 neuen Tests; keine Route gab fremde Daten
  preis, ein Termin ließ sich aber über seine Kennung aus einem fremden Jahrgang abrufen — behoben
  (`d80222fc`; Tests BF-01).

### Fachliche Fehler (Termine, Punkte, Rückblick, Mitgliedschaften)

- **Vortags-Erinnerung** kam kurz nach Mitternacht (bis zu 34 h vorher); jetzt 24 h ± 15 min vor
  Beginn, mit Laufmerker gegen Doppelversand (`253b739e`).
- **Wieder anmelden** nach Abmeldung durch die Leitung, **Warteliste verlassen**, Abmelderegeln
  auch über den älteren Nebenweg (`febfeb33`, `8150b86c`).
- **Konfi-Rückblicke** überleben das Löschen ihres Jahrgangs (Migration 162, `75094b16`).
- **Doppelte Schreibvorgänge** bei schlechter Verbindung: kein automatischer Retry mehr für
  Anfragen ohne Idempotenzschlüssel (`4ce13ead`).
- **Punktwert am Zuordnungsdatensatz**: ein geänderter Punktwert wirkte rückwirkend auf alle
  Vergaben; jetzt merkt sich jede Vergabe ihren Wert (Migration 163 mit Backfill, 13 s bei
  1 Mio. Zeilen, `d675fd52`).
- **Eingeladene** fehlten unter „Benutzer:innen" und in Gruppenchats, bekamen keinen
  Team-Rückblick und sahen in der zweiten Gemeinde die falsche Rolle oder den falschen Rückblick;
  alles je Gemeinde (`260b82b7`, `a22fe672`, `c34ff817`, `1122acd9`; Leitung BF-01, Chat
  BF-04/06/08).
- **Registrierung** übernahm das Refresh-Token nicht — neue Konfis flogen nach 15 Minuten aus der
  Sitzung (`853ab400`; Grundgerüst BF-03).
- **Gemeinde-Rückfall** nach entzogener Mitgliedschaft: Token ohne Org-Claim, Socket-Neuaufbau,
  keine leeren Listen mehr (`0ffa88ff`; BF-05).
- **Gerätebefunde vom 26.09. abends:** Der Rückwechsel in die Stamm-Gemeinde scheiterte bei
  Konten, die nach Migration 101 angelegt wurden — die Wechsel-Route kannte nur die
  Zusatz-Gemeinden; jetzt beide Quellen, Store-Apps profitieren mit (`b9b58257`). Die
  Einladungskarte der Leitung stand auf „Mehr", Push und Postfach führten ins Profil; jetzt bei
  allen Rollen im Profil (`42943efe`).
- **Gerätebefund vom 27.09.:** Am Gemeinde-Umschalter zählte jede ungelesene Mitteilung so oft,
  wie die Person Gemeinden mit derselben Rolle hat. Ein Challenge-Beitrag mit Freigabe ergab dort
  3 statt 2. Jetzt zählt jede Mitteilung einmal, bei ihrer Gemeinde (`11354452`).
- **Entscheidungen vom 27.09. zu Challenges:** Leitung und Team sehen neue Beiträge wie im Chat,
  als rote Zahl am Reiter und an der Challenge bis zum Öffnen, auch ohne Freigabe; wartende
  Freigaben bleiben das orange Feld, nichts zählt doppelt (`82220504`, Migration 168). Admins
  sehen, zählen und bekommen Mitteilungen zu jeder Challenge, bei der das Team mitmacht, bei
  reinen Konfi-Challenges nur mit Jahrgang; Teamer:innen bekommen die Mitteilung auch bei
  Challenges nur fürs Team, niemand über den eigenen Beitrag (`62cb6b3c`).

### Chat, Push und Skalierung (eine Datenbank, Gemeinden bis 150 Teilnehmende)

- **Chat-Nachricht**: 2.002 → 22 Datenbankabfragen bei 150 Teilnehmenden, Push-Fan-out einmal
  statt je Kopf, `newMessage` je Client genau einmal (`4e2d21e0`, `14086caa`).
- **Löschen bei vielen Nachrichten**: 32 s → 10 ms durch Indizes auf `chat_messages`
  (Migration 160, `2d26d743`).
- **Terminlisten** 77 ms → 2 ms je Termin statt über die ganze View (`f9f6bb01`).
- **Erinnerungen** je Termin vorgemerkt und gesammelt (1.802 → 35 Abfragen bei 200 Zusagen),
  App-Icon-Lauf ohne Push-Sturm nach Neustart, Registrierungs-Pushes in Blöcken (`dc687ebe`,
  `fd338a55`, `53738feb`).
- **Datenbank-Abbruch** beendete beide Replicas zugleich; jetzt bleiben sie erreichbar und
  verbinden sich neu (`009fec6f`).
- **Rate-Limiter** zählen in der Datenbank statt je Replica (Migration 167, `547e3930`);
  **Cron-Leader** per Advisory-Lock mit Übernahme (`76b71dd9`); **Graceful Shutdown** Exit 0 in
  unter 1 s statt Exit 1 nach 10 s (`a64834fc`); **Migrationslauf** ohne 30-s-Grenze, Stand in
  `/api/status` (`be2af118`); **Rückblick-Erstellung** mit Parallelität 3 statt vollem Pool
  (`01fd7b21`); **Kennzahlen-Verlauf** 33 MB → 116 kB (`edcb6bd6`); **Startseeding**
  idempotent (`de9c4424`).
- **Deploy** in zwei Stufen mit Gesundheitsprüfung statt beide Replicas zugleich (`ee996132`);
  **Postgres** in der Compose-Referenz auf 2 CPU / 3 GB mit Pool-Vorgaben (`8fc28171`);
  **Sicherung und Wiederherstellung** beschrieben (`3f8cab97`).

### Dunkelmodus

- **Fünf Auflagen** (Paket A): Anmeldeseite 1,4 → 8,4:1, Dashboard-Verläufe 1,3 → 9,1:1,
  Kartenregel schlägt das iOS-Theme, Reaktionszähler, Befördern-Knopf (`bc9e5a0c`–`5f5c02da`).
- **Systematischer Umbau** (Paket K): Ionics Flächenvariablen je Plattform an die App-Tokens
  gebunden (iOS-Listen nicht mehr tiefschwarz), Text-Token je Bereichsfarbe für 20 Bereiche,
  Grautöne hell wie dunkel ≥ 4,5:1 (`9d565d07`, `c11640f8`, `f01dcf04`, `47ee85e2`).
- **Rest und Messung** (Paket K2): Eck-Marken im Dunkeln eine Stufe tiefer (2,15–4,23 →
  5,41–8,97:1), Prozentzahl im Abzeichen-Ring über Kriterien-Token; der „Anmelden (0/50)"-Knopf
  war ein Messfehler (real 10,78:1). Die Messung liegt als `npm run dunkelmodus:messen` mit
  begründeter Restliste vor (`67ac86e3`, `33a3f3f4`, `59f53de8`).
- **Ergebnis**: 104 → 16 Textstellen, alle die eigene Chat-Blase (2,43:1 in beiden Modi);
  0 helle Flächen.

### Barrierefreiheit

- **Anmeldeseiten** (Paket F): Feldnamen, Links als Links, Enter sendet, Alarm-Regionen,
  Fokusring, `lang="de"`; Layout pixelgleich (`43f3ec67`, `78c4db01`).
- **Ganze App** (Paket M): 186 Formularfelder mit Namen (170 → 0 ohne), 135 klickbare Elemente
  per Tastatur bedienbar, 17 Modale mit Namen, zehn kleine Knöpfe mit 44-px-Trefffläche bei
  gleicher Optik, „Bewegung reduzieren" app-weit (`53bf4658`–`632302d4`).
- **Chat-Aktionen ohne langen Druck**: Reagieren, Antworten, Teilen und Löschen gingen nur per
  langem Druck oder unsichtbarem Rechtsklick, per Tastatur gar nicht. Jetzt ein Knopf neben jeder
  Nachricht, am Rechner beim Überfahren sichtbar, per Tab erreichbar, Escape schließt; auf dem
  Handy bleibt der lange Druck (`83f5038b`).

### CI, Release und Tests

- **Release-Tor**: Store-Builds nur von `main` nach grünem CI-Lauf desselben Commits; Deploy
  überschreibt nur Live-Dienste; keine parallelen Deploys; Typprüfung und Web-Build vor dem Test-Gate;
  kein `--passWithNoTests`; `npm audit` blockiert ab hoch; Lint bei jedem Push, 19 Altfehler
  bereinigt (`9bd915bd`–`38cfc5b8`, `02bf4045`, `2bb4ad17`).
- **Weiche Assertions** geschärft, Frist-Test liest die echte Stornoregel (`62bb0ba2`,
  `a4574cef`).

### Dokumentation und Regeln

- **Store-Texte 2.3.0**, Handbuch gegen den Code (E-Mail-Wechsel, Challenge-Rechte, Beförderung,
  Umschalter), API-Rollen an fünf Routen, zwei Routen nachdokumentiert, Abrissliste gegen Tag 2.2.0,
  README-Installationsweg, veraltete Kommentare (`44902390`–`f057e7a0`).
- **CHANGELOG** zusammengeführt: neun Überschriften → fünf, Umschalter-Einträge gegen den Code,
  Netto-null-Paare und Unreleased-interne Korrekturen gestrichen, Framework-Name ersetzt
  (`e4c940df`, `b515fc03`).
- **Versionsnummern**: eine Quelle (`frontend/version.json`), die drei `package.json` samt
  Lockfiles und das iOS-Projekt folgen ihr über `npm run version:setzen`, `/api/status` meldet
  2.3.0 statt 1.0.1, Test und Regel in CLAUDE.md samt Ausnahme für die Build-Zeile (`dd8cf2ad`).

## Was offen bleibt

Aus den Status-Zeilen aller Berichte (Stand 27.09., 06:00 UTC). Nichts davon blockiert das
Release 2.3.0; die Gesamtabnahme führt es unter „Vor EKD-Ausrollung" und „Danach".

**Produkt- und Farbentscheidungen (Simon sieht sie sich an):**
- Eigene Chat-Blase: weiße Schrift auf Chat-Türkis, 2,43:1 in beiden Modi (16 Stellen).
- Kopfbanner der Termindetails: weiße Überschrift auf Statusgrün 2,02–2,22:1, Untertitel 1,74,
  in beiden Modi (UI BF-04, Nebenbefund K2).
- „Event absagen" auf dunkler Karte 4,39:1 — die einzige dunkelspezifische Reststelle.
- Hellmodus: Bereichs-, Signal- und Kriterienfarben als Schrift (Abzeichen 2,15, Chat 2,43,
  Benutzer 3,66:1) und die Eck-Marken im Hellen (2,15–4,23:1); der Text-Token je Bereich ist hell
  absichtlich die Bereichsfarbe — ein hellerer Wert lässt sich je Bereich an einer Stelle setzen.
- Gedämpfter Link „Passwort vergessen?" im Hellen 4,37:1.
- Begriffe „Events/Badges" gegen „Termine/Abzeichen" (UI BF-10), 45 Substantiv-Überschriften im
  Handbuch hängen daran (Doku BF-17).
- Handbuch-Kapitel „Für den Betrieb" (Super-Admin, Gemeinde anlegen, Testphase) — was davon
  Gemeinden lesen sollen (Doku BF-16).
- Mitteilungen an die Leitung außerhalb der Challenges (neue Anträge, Registrierungen, Termine
  und weitere) gehen weiter an alle Admins der Gemeinde, auch an jahrgangsgebundene, die den
  Vorgang in ihren Listen nicht sehen. Für Challenges ist das am 27.09. entschieden und umgesetzt.
- Wer eine Person löscht, die in der eigenen Gemeinde zuhause ist, löscht ihr Konto — und damit
  auch ihre Mitgliedschaften in anderen Gemeinden. Eine Warnung dazu gibt es nicht.

**Barrierefreiheit, nicht Teil eines Pakets:** Datumsformate und Dynamic Type (UI BF-07, BF-14);
die 92 per Hook geöffneten Modale ohne Namen (nur je Aufruf lösbar); `UpdateHinweisKarte` mit
Knopf im Knopf.

**CI und Release:** Reihenfolge zweier Deploys bei ungleicher Testdauer (CI BF-04, Rest); aktive
Benachrichtigung bei rotem `main` (BF-07, Rest); Git-Tag je Store-Upload und Zurückcommitten der
Info.plist-Build-Nummer (BF-09, Rest); Action-Pinning, `test-backend.yml`, `frontend.yml`,
Compose-`version`, Kommentar in `ci.yml` (BF-15); Sitemap-Erzeugung reproduzierbar und geprüft
(Doku BF-13).

**Betrieb (nur mit Zugang zur Produktion):** Portainer-Stack an die Compose-Referenz angleichen
(Betrieb BF-13, Datenbank BF-07 — Referenz steht, Anwendung fehlt); Sicherungs-Rhythmus,
Aufbewahrung und Rückspielprobe im Betrieb einrichten (Datenbank BF-05); Log-Sammelzeilen
(Betrieb BF-11); Absender-Adresse `moin@` gegen `SMTP_FROM` messen (Doku BF-20).

**Recht und Rechenschaft:** Datenschutzerklärung auf 2.3.0, Verarbeitungsverzeichnis, TOM, AVV
(Doku BF-08, Sammelbefund S-20); Sichtbarkeit von Daten in einer zweiten Gemeinde als
Datenschutzfrage.

**Hygiene:** 27 unreferenzierte Screenshots im Handbuch-Spiegel, 42 neu zu ziehende Bilder
(S-17, nach dem Deploy); undeklarierte Importe, tote Einträge und `overrides` (Toolchain BF-10,
Rest); Zahlen in Test-Kommentaren (Tests BF-11); drei Schema-Kommentare (Datenbank BF-13); die
17 Flächen-Hexwerte der Abzeichen-Kriterien außerhalb der Tokens (darkmode BF-10, Rest);
Feature-Empfehlungen (Punkt 32) und NIEDRIG-Befunde ohne Paket (Punkt 36).

## Was bei Simon liegt

1. **Apple-Schlüssel** `7AQA623H3T` und `A29U7SN796` im Developer-Portal widerrufen oder den
   Widerruf bestätigen — der letzte offene Blocker.
2. **Vor dem Deploy** in Portainer: `SMTP_HOST`, `SMTP_USER`, `SMTP_HOST_IP` als Stack-Variablen;
   SMTP-Zertifikat gegen den Hostnamen prüfen, sonst Notnagel `SMTP_TLS_REJECT_UNAUTHORIZED=false`.
3. **Vor dem Deploy zählen:** `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL) FROM
   konfi_profiles;` und `SELECT count(*) FROM user_activities;` (Backfill unter 30 s halten).
4. **Portainer-Stack angleichen:** Postgres 2 CPU / 3 GB mit den Vorgaben, `PG_POOL_MAX=50` und
   die übrigen `PG_*`, `SHUTDOWN_DRAIN_MS`, `RUN_BACKGROUND_JOBS=false` bei `backend2` entfernen;
   einmal `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`; den ersten zweistufigen Deploy
   beobachten.
5. **Nach dem Deploy:** Screenshots neu ziehen (Punkt 22), Produktionsmessungen aus dem Abschnitt
   „Auf Produktion nachzumessen" der Gesamtabnahme.
6. **Farb- und Produktentscheidungen** aus dem Abschnitt oben.
7. **Autorenschaft der älteren Commits:** 50 Commits tragen noch „Claude" als Autor, 56 als
   Committer. Das Umschreiben ändert alle Commit-Kennungen des Branches und braucht einen
   Force-Push; die Rechteprüfung dieser Sitzung hat es abgelehnt. Nach dem Umschreiben müssen
   die Commit-Verweise in Gesamtabnahme, Behebungsbericht und Doku-Bericht nachgezogen werden.

## Entscheidungen der Umsetzung, die Simon kippen kann

Vortags-Erinnerung zur gleichen Uhrzeit am Vortag (24 h ± 15 min) statt zu einer festen Tageszeit;
Konfis als Einladungsziel antworten wie unbekannte Kennungen (Team-Konten bleiben auffindbar); in
einer weiteren Gemeinde lassen sich nur Rolle und Jahrgänge ändern, Kontofelder bleiben bei der
Stamm-Gemeinde; Refresh-Gnadenfrist genau eine Wiederverwendung, die dritte widerruft alle Tokens
des Kontos; SMTP-Zertifikatsprüfung standardmäßig streng; Eck-Marken nur im Dunkeln abgesenkt, im
Hellen unverändert; Versionsnummern nur noch über `npm run version:setzen`.
