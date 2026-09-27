# Behebungsbericht zum Release-Audit 2.3.0

Stand 27.09.2026, abends (Code-Stand `9e7fa4c8`). Was seit der Gesamtabnahme vom 26.09. behoben
wurde, was offen bleibt und was bei Simon liegt. Dazu gehört das Audit „Wer bekommt was" vom 27.09.
(`docs/audit/2026-09-27/wer-bekommt-was.md`) samt seinen Behebungspaketen. Jeder Punkt steht als Commit auf dem Release-Branch;
die Berichte je Bereich tragen an jedem Befund eine Status-Zeile mit Datum. Die Regeln für jede
Behebung standen im gemeinsamen Auftrag der Pakete: Test für den verbotenen und den erlaubten
Fall, Gegenprobe (Fix raus → Test rot), CHANGELOG, Handbuch und API-Doku im selben Commit,
Antwortformen unverändert (Store-Apps 2.2.x lesen weiter), Migrationen additiv.

## Kurzfassung

| | Vor dem Audit | Jetzt |
|---|---|---|
| Blocker der Gesamtabnahme | 7 | 0 offen (Apple-Schlüssel am 27.09. widerrufen) |
| Auflagen vor Release (Punkte 8–24) | 17 | 1 offen (Screenshots nach dem Deploy) |
| Audit „Wer bekommt was" (27.09.) | 22 Befunde, davon 9 HOCH | 21 behoben, 1 geprüft und regelkonform |
| Backend-Tests | 139 Dateien / 3.399 | 188 Dateien / 3.970, grün |
| Frontend-Tests | 264 Dateien / 3.788 | 322 Dateien / 4.474, grün |
| Dunkelmodus, Textstellen unter 4,5:1 (94 Zustände) | 104 | 16 (alle: eigene Chat-Blase, in beiden Modi) |
| Formularfelder ohne Namen für die Vorlesefunktion | 170 von 186 | 0 |
| Klickbare Elemente ohne Tastaturbedienung | 147 | 0 |
| Per Hook geöffnete Dialoge ohne Namen für die Vorlesefunktion | 92 | 0 |
| Datumsformate in der App | 17 Optionssätze in 88 Aufrufen | 3 Formate an einer Stelle |
| Commits auf dem Branch über `main` | — | 196 (Berichte, Behebung, Nachweis) |
| Neue Migrationen | — | 160, 162–168 (alle additiv) |

Arbeitsweise: Die Koordination hat die fünf Blocker selbst behoben und danach Pakete an
parallel arbeitende Agenten vergeben (14 am 26.09., 16 weitere am 27.09.), jedes in einem eigenen Arbeitsbaum mit demselben Auftrag.
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

### Eine Regel: wer sieht und bekommt was (27.09.)

Simon hat die Regel am 27.09. festgelegt, sie steht in CLAUDE.md („Wer sieht und bekommt was",
`60a8d8d7`, `4ab12e4b`): Org-Admin alles seiner Gemeinde; Admin und Teamer:in nur ihre
Jahrgänge, mit den Team-Ausnahmen „Nur Team", Events ohne Jahrgang und Chat im Team; Konfis den
eigenen Jahrgang und die Events ohne Jahrgang; Mitteilung = Sichtbarkeit. Das Audit „Wer bekommt
was" (`427cd7ad`) hat Mitteilungen, Zähler und Listen je Rolle dagegen geprüft: 22 Befunde, 9 davon
HOCH, 15 Fragen an Simon — alle beantwortet (`9401f64d`, `f36402e5`, F-05 nachträglich).

- **Anträge** melden sich nur bei der Leitung, die sie sieht: Org-Admins, Admins mit Leserecht
  auf den Jahrgang der Konfi; Anträge von Teamer:innen an alle Admins (`c7496853`; BF-02).
- **Event-Meldungen** (Abmeldung mit Grund, Opt-out/-in, Zu- und Absagen des Teams, Verbuchen),
  **Registrierung**, **Jahrgangs-Löschwarnung** und **Lizenz-Erinnerung** nur an die Leitung des
  Jahrgangs bzw. an alle Org-Admins; Empfängerfilter verlangt Leserecht (`9e098492`, `e46932d2`,
  `23be613f`, `56dfd53c`; BF-01, 03, 09, 10, 11, 16, 18).
- **Chat:** Admins öffnen ohne Teilnahme nur Räume ihrer Jahrgänge (`677a8e91`; BF-05); das Ende
  einer Mitgliedschaft räumt alle Chat-Plätze der Gemeinde (`aa005d31`, `1eec4910`; BF-08); eine
  Beförderung zur Teamer:in gleicht Jahrgangs-, Event- und Team-Chat sofort ab (`6b452727`;
  BF-19); der Event-Chat nimmt nur bestätigt Angemeldete auf (`00da0b25`; BF-17).
- **Konfis:** „Neues Event!" nur an Konfis, die das Event in ihrer Liste sehen (`49e95d5b`;
  BF-04). Events ohne Jahrgang gelten der ganzen Gemeinde — alle Konfis sehen, bekommen und
  buchen sie. Dabei geschlossen: Konfis konnten sich per Kennung zu Events fremder Jahrgänge
  anmelden und deren Teilnehmende lesen (`ac86d860`; F-05).
- **Team:** Ein gelöschtes Event meldet sich bei allen Gebuchten wie eine Absage (`fa754707`;
  BF-06); Start-Mitteilung und „neue Challenge" für alle, die mitmachen (`d570ee4e`; BF-07).
- **Die betroffene Person erfährt es:** Austragen und Zurücksetzen auf die Warteliste
  (`9399a6a0`; BF-14), Bestätigungsmail nach einer Passwortänderung und „Passwort vergessen" für
  genau das richtige Konto (`a20e830e`; BF-20), Zusage und Absage einer Einladung an die
  einladende Leitung (`c959e6df`; BF-21).
- **Zähler:** Das App-Symbol zählt bei mehreren Gemeinden je Gemeinde mit der dortigen Rolle
  (`5c14bf61`, `6a317c31`; BF-12); die Postfach-Glocke zählt beim Lesen sofort herunter, eine
  ältere Zählung überschreibt keine neuere mehr (`faa54547`; Gerätebefund).
- **Postfach und Hintergrund:** Mitteilungen über eine Person gehen mit ihrem Konto und mit dem
  Ende der Mitgliedschaft (`c913b455`; BF-13); eine gesperrte Gemeinde bekommt nichts mehr von
  allein (`0a4da269`; BF-22); gemeindeweite Live-Signale tragen nachweislich keinen Inhalt
  (`40bb8397`; BF-15, geprüft).
- **Challenges:** drei Zielgruppen — „Nur die Konfis" wieder da, Konfis und Team nur mit Jahrgang,
  „Nur das Team" für das ganze Team (`da9bc4bc`).
- **Mitgliedschaften:** Wer in der eigenen Gemeinde zuhause ist und weitere Gemeinden hat, wird
  nur aus der eigenen entfernt, das Konto bleibt (`6c4fe468`).

### Medien: ein System für Chat, Challenges, Anträge und Material (27.09.)

Simon: „Das kann ja ein System sein. Und wir haben ja einen Medien-Cache!"

- **Ein Medien-Cache** für alle geschützten Datei-Routen, je Quelle getrennt; Bilder und Dateien
  der Challenges und des Materials laden beim zweiten Öffnen ohne Download, auch ohne Netz, mit
  Fortschritt, „Erneut versuchen" und Öffnen samt Teilen (`17266eae`, `98421a9e`, `b3fdae34`,
  `7b436360`).
- **Datenschutz:** Der Cache gehört zum Konto und wird beim Abmelden, beim Wechsel von Konto oder
  Gemeinde geleert — vorher fand die nächste Person am Gerät die Dateien der vorigen
  (`4c2c5f66`). Nachweisfotos der Anträge laufen durch dieselben Bausteine, landen aber nie auf dem
  Gerät (`2a17f82d`, `e36275ff`).
- **Verkleinerung und Grenzen** beim Hochladen auf einem Weg: Fotos lange Kante 1920 px, Grenze je
  Quelle wie beim Server (Chat 5 MB, Challenges 50 MB, Nachweisfoto 5 MB, Material 20 MB), ein
  Satz für „zu groß" (`c67ac3c8`). Videos werden nicht verkleinert.
- **Ohne Netz:** Challenges und Material zeigen den zuletzt geladenen Stand, bei Netz entscheidet
  zuerst der Server — Gelöschtes verschwindet auch vom Gerät (`4407180c`, `7b436360`).

### Nutzungsmessung (27.09.)

- **Datenschutzbefund behoben:** Die Fehlermessung übertrug angezeigte Server-Meldungen — darin
  Namen von Konfis — an Umami und in die Absturzprotokolle. Jetzt nur noch Texte einer
  Positivliste (203 der App, 19 feste Anmeldetexte des Servers), sonst der Ersatztext der Stelle
  mit dem Status (`7428d316`, `5f916540`, `9e7fa4c8`); die Bereinigung der schon gesammelten Daten
  liegt als Auftrag vor (`4fca331a`).
- **Messkonzept** mit Bestandsaufnahme, Grundsätzen und 17 Vorschlägen (`0f4212d0`).
- **Neu gemessen:** Events und Aktivitäten unter „Mitmachen" getrennt, „Aktivität eingereicht"
  (`e7a6dc92`); Anträge entschieden (angenommen/abgelehnt, von Konfi oder Team), Material
  angesehen und abgerufen, Konfispruch gespeichert (`8fbefc85`) — ohne Namen, Titel oder
  Kennungen.

### Die letzten HOCH-Befunde und der Weg zum Deploy (27.09., abends)

Drei HOCH-Befunde standen nie auf der Release-Liste der Gesamtabnahme; Simon hat sie am 27.09.
vor den Merge gezogen, dazu die Mindestversion (Feature E-05).

- **Funkloch** gilt als offline: Meldet das Handy keine Verbindung, fragt die App den Server
  (Probe an `/api/health`, 4 s); antwortet er, bleibt sie online (die Play-Prüfumgebung meldet
  „keine Verbindung" bei funktionierendem Netz), sonst sammelt die Warteschlange und prüft alle
  15 s neu (`1a379aba`; Grundgerüst BF-01).
- **Abgelaufene Sitzung, anderes Konto am Gerät:** Gespeicherter Stand und Warteschlange gehören
  zum Konto — eine andere Person sieht nichts, wartende Nachrichten gehen nicht unter falschem
  Namen raus, dieselbe Person findet alles wieder (`c526cdfa`; Grundgerüst BF-04).
- **Anmeldesperre je Konto**, Bibelvers-Passwörter bleiben (Simon: „der Witz ist einfach zu
  gut"): nach 10 falschen Passwörtern in einer Stunde 429, über alle Replicas, auch für
  unbekannte Namen gleich. Durchprobieren eines Kontos vorher 25,6 h je IP, jetzt im Mittel
  64 Tage (ganzer Raum 128 Tage). Dabei gefunden und behoben: Die Anmeldeseite zeigte bei
  jeder Ablehnung — auch falschem Passwort — „Keine Verbindung zum Server" (auch in 2.2.x)
  (`1a047f86`, `fc2b7add`; Sicherheit BF-04).
- **Mindestversion und Wartungshinweis** über `/api/app-version` (nur neue Felder, 2.2.x liest
  sie nicht): unter der Mindestversion ein Sperrbildschirm mit Store-Knopf, nie im Browser, nie
  ohne Netz; der Wartungstext auf allen Startseiten (`d7802549`; E-05).
- **Deploy-Falle:** Alle drei Deploy-Wege schickten Portainer eine leere Liste der
  Stack-Variablen; Portainer ersetzt sie damit. In Produktion folgenlos, weil die Werte direkt in
  der Stack-Datei stehen — jetzt gehen vorhandene Variablen unverändert zurück (`b168c55f`
  vor dem Merge von `main`). Referenz-Compose: Fotoschlüssel und Doku-Passwort als Pflicht,
  `TZ` bewusst nicht gesetzt (`b677bba5`).
- **Zeitzone gemessen:** Produktion rechnet in UTC (Node-Prozess und Datenbanksitzung), die Tests
  gingen von Berlin aus. Die volle Suite wie Produktion (beides UTC) lief bis auf die zwei Tests,
  die genau die Berlin-Annahme prüfen, grün (3.968 von 3.970); der Code rechnet seine
  Kalendertage selbst in Berliner Zeit. Kommentare korrigiert, Lauf per
  `TEST_DB_SITZUNGSZONE=UTC` wiederholbar.
- **Kompatibilität mit der Store-App 2.2.0** (Tag `2.2.0`, iOS-Build 206, Android versionCode
  113) gegen das Backend 2.3.0: 303 Aufrufstellen, 196 Routen, 25 Warteschlangen-Einträge,
  9 Socket-Ereignisse der alten App. Jede Route gibt es noch, Antwortformen gleich, nur neue
  Felder; kein Absturz, kein Hängenbleiben. Zwei Befunde behoben:
  - Die **Zahl am App-Symbol** (iOS) zählte seit 24./25.09. das Postfach und die
    Challenge-Neuigkeiten mit; die alte App kann beides nicht abbauen, die Zahl wäre nie auf
    null gegangen. Geräte ohne `app_version` am Push-Token (2.3.0 meldet sie mit, 2.2.x nicht)
    bekommen jetzt die Rechnung von 2.2.0 — in jedem Versandweg und im Hintergrundlauf, ohne
    zusätzliche Abfrage (`48c998cc`).
  - **Rolle eines Zusatzmitglieds ändern** scheiterte mit 400, wenn E-Mail oder Funktion in
    der Datenbank als `''` stehen: Die alte App schickt `null`. Leerer Text und NULL gelten
    jetzt als gleich, Rand-Leerzeichen zählen nicht; geschrieben wird weiter nur die Rolle
    (`504acb29`).

  Bewusst so gelassen (am Gerät sichtbar, kein Bruch): Chat-Medien laden in 2.2.x ohne
  Prozentanzeige (gestreamt, ohne `Content-Length`); gehen zwei Refresh-Antworten hintereinander
  verloren, ist die dritte Nutzung eine Wiederverwendung und meldet alle Geräte des Kontos ab
  (vorher innerhalb von 5 Minuten erlaubt); wählt die Leitung in 2.2.x eine Person ohne Jahrgang
  des Events als Teilnehmende, kommt „Fehler beim Hinzufügen" ohne Grund (403
  `person_jahrgang_fremd`); neue Push-Arten (Einladung, Warteliste, ausgetragen) öffnen die alte
  App ohne Sprung; Konfis ohne Jahrgang sehen die Termine ohne Jahrgang — auch Pflichttermine
  ohne Jahrgang aus dem Bestand.
- **Betrieb Phase A** (lokaler Agent, vor dem Merge): Sicherung, Postgres auf 2 CPU / 3 GB mit
  `pg_stat_statements`, Pool 50 und Zeitgrenzen; ein Stack-Update mit 22 s bis gesund, 1 von
  240 Statusabfragen gescheitert. Ergebnisse in `docs/auftraege/lokaler-agent/`.

### Handbuch, Sprache und Barrierefreiheit (27.09.)

- **Handbuch-Navigation** mit den Abschnitten des Kapitels als Unterpunkten (`f0074acd`,
  `1923e9b1`); Überschriften nennen Tätigkeiten (`08b5730b`; Doku BF-17).
- **Begriffe** nach Simons Entscheidung: Events, Badges, Challenges, Stempel in App, Backend und
  Handbuch, Glossar im Handbuch (`cd56127b`, `ebbaceae`; UI BF-10); echte Umlaute in allen
  Nutzertexten, 19 → 0 Stellen mit Prüfung über App und Backend (`8874afd1`; UI BF-11).
- **Barrierefreiheit:** Jeder Dialog nennt der Vorlesehilfe seinen Titel, 92 → 0 ohne Namen
  (`bfd599c6`); Hinweiskarten ohne Knopf im Knopf (`5aa13b4c`); Zoom im Browser frei,
  Reiter-Beschriftungen 8,8 → 11,2 px (`c0ee345f`; UI BF-07); drei Datumsformate statt 17
  (`9412b496`; UI BF-14).
- **Kleinere Gerätebefunde:** Event-Karten auf der Startseite nennen den Wochentag (`6ddd003d`);
  im Chat beendet ein Zeilenumbruch allein keinen Satz mehr, großgeschrieben wird nur am Anfang und
  nach . ! ? (`0e114bdf`).

## Was offen bleibt

Aus den Status-Zeilen aller Berichte (Stand 27.09., abends). Nichts davon blockiert das
Release 2.3.0; die Gesamtabnahme führt es unter „Vor EKD-Ausrollung" und „Danach".

**Entschieden am 27.09. und damit erledigt:** Farben (Simon nimmt die verbleibenden Stellen an:
eigene Chat-Blase, Kopfbanner der Event-Details, „Event absagen" auf dunkler Karte, Bereichsfarben
als Schrift im Hellmodus, „Passwort vergessen?"), Begriffe (Events, Badges, Challenges, Stempel —
umgesetzt), kein Betriebs-Kapitel im Handbuch („Ich bin der Betreiber!"), Mitteilungen an die
Leitung nur nach Jahrgang (umgesetzt, Abschnitt oben), Entfernen statt Löschen bei weiteren
Gemeinden (umgesetzt).

**Offen zur Entscheidung (Simon):**
- Nutzungsmessung: die Vorschläge S1–S17 in `docs/messung/umami.md` (etwa Bibelstelle des
  Konfispruchs, Anträge-Ansicht, Postfach, Push-Auswahl, Dunkelmodus).
- Material-Bilder werden beim Hochladen wie im Chat verkleinert (lange Kante 1920 px). Wer Bilder
  zum Drucken ablegen will, bekommt sie kleiner; eine Zeile schaltet das für Material ab.
- Videos werden nicht verkleinert, nur gegen die Größengrenze geprüft. Empfehlung: so lassen,
  keine neue Bibliothek.

**Bekannte Reste ohne Regelverstoß:**
- Mitteilungen, die vor 2.3.0 über eine Person geschrieben wurden, tragen keinen Personenschlüssel
  und verschwinden nicht mit deren Konto, sondern wie bisher mit Event, Challenge oder nach
  365 Tagen („Wer bekommt was" BF-13). Wie viele es in Produktion sind, ist nicht gemessen.
- `sendToUserByRole` wählt den Live-Raum nach der Rolle in der Stamm-Gemeinde: Wer in der aktiven
  Gemeinde eine andere Rolle hat, verpasst sein eigenes Nachlade-Signal (kein Fremdempfang, BF-15).
- Mehr als zehn Material-Dateien auf einmal prüft die App nicht vorab; der Server nimmt höchstens
  zehn an.
- **Zeitzone:** Produktion läuft in UTC. 24 Spalten speichern eine Uhrzeit ohne Zone (in UTC
  geschrieben); vier SQL-Stellen rechnen mit `CURRENT_DATE` und nehmen zwischen 0 und 2 Uhr
  Berliner Zeit den Vortag (Zertifikatsablauf, Team-Eventliste, „Teamer:in seit",
  Löschfristen) — wie in 2.2.x. Saubere Lösung nach dem Release: die Spalten auf
  `timestamptz` umstellen (Muster Migration 138); `TZ` bis dahin nicht setzen.
- **Refresh-Tokens:** 1.232 offene auf 129 Konten (größte 189); kein Lauf entfernt abgelaufene
  oder widerrufene. Aufräumen und eine Obergrenze je Konto nach dem Release.
- **Nach dem Deploy zu messen (Kompatibilität):** wie viele Push-Tokens ohne `app_version`
  (= Geräte mit 2.2.x) und wie viele ungelesene Mitteilungen es je Person gibt; ob die
  IP-Grenzen je Adresse zählen (in `rate_limit_zaehler` viele Schlüssel je Limiter, nicht einer
  für alle — die Adresse kommt aus `X-Real-IP`, wenn der Proxy aus dem Docker-Netz kommt);
  wie viele Pflichttermine ohne Jahrgang aktiv sind.
- **Anmeldesperre:** Die Test-API arbeitet auf derselben Datenbank; bis sie den neuen Stand fährt
  (`test-backend.yml` nach dem Merge), gilt dort keine Sperre. Ein gezieltes Aussperren eines
  bekannten Kontos bleibt möglich (10 Versuche je Stunde), begrenzt durch das Fenster und
  sofort aufhebbar mit neuem Passwort.

**Barrierefreiheit:** Dynamic Type auf iOS am Gerät bestätigen (UI BF-07 b, nach dem Code kein
Befund); echtes VoiceOver/TalkBack wurde nicht geprüft.

**CI und Release:** Reihenfolge zweier Deploys bei ungleicher Testdauer (CI BF-04, Rest); aktive
Benachrichtigung bei rotem `main` (BF-07, Rest); Git-Tag je Store-Upload und Zurückcommitten der
Info.plist-Build-Nummer (BF-09, Rest); Action-Pinning, `test-backend.yml`, `frontend.yml`,
Compose-`version`, Kommentar in `ci.yml` (BF-15); Sitemap-Erzeugung reproduzierbar und geprüft
(Doku BF-13).

**Betrieb (nur mit Zugang zur Produktion):** Portainer-Stack an die Compose-Referenz angleichen
(Betrieb BF-13, Datenbank BF-07 — Referenz steht, Anwendung fehlt); Sicherungs-Rhythmus,
Aufbewahrung und Rückspielprobe im Betrieb einrichten (Datenbank BF-05); Log-Sammelzeilen
(Betrieb BF-11); Absender-Adresse `moin@` gegen `SMTP_FROM` messen (Doku BF-20). Die Schritte
stehen als Aufträge für einen Agenten mit Zugang in `docs/auftraege/lokaler-agent/`, dazu neu:
die in Umami gesammelten Fehlermeldungen bereinigen und Sitzungssalz sowie Ortsangaben der
Umami-Instanz prüfen (`03-nach-dem-deploy.md`, Abschnitt 6).

**Recht und Rechenschaft:** Datenschutzerklärung auf 2.3.0, Verarbeitungsverzeichnis, TOM, AVV
(Doku BF-08, Sammelbefund S-20); Sichtbarkeit von Daten in einer zweiten Gemeinde als
Datenschutzfrage.

**Hygiene:** 27 unreferenzierte Screenshots im Handbuch-Spiegel, 42 neu zu ziehende Bilder
(S-17, nach dem Deploy); undeklarierte Importe, tote Einträge und `overrides` (Toolchain BF-10,
Rest); Zahlen in Test-Kommentaren (Tests BF-11); drei Schema-Kommentare (Datenbank BF-13); die
17 Flächen-Hexwerte der Abzeichen-Kriterien außerhalb der Tokens (darkmode BF-10, Rest);
Feature-Empfehlungen (Punkt 32) und NIEDRIG-Befunde ohne Paket (Punkt 36).

## Was bei Simon liegt

1. **Apple-Schlüssel** `7AQA623H3T` und `A29U7SN796` — am 27.09. widerrufen, erledigt.
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
6. **Nach dem Deploy, Umami:** die gesammelten Fehlermeldungen bereinigen (Auftrag
   `03-nach-dem-deploy.md`, Abschnitt 6: sichern, zählen, ersetzen, erneut zählen), solange
   Store-Fassungen ohne die Korrektur im Umlauf sind monatlich wiederholen; Sitzungssalz
   (`SALT_ROTATION`) und die Speicherung von Region und Stadt mit der Datenschutzerklärung
   abgleichen (B4).
7. **Offene Entscheidungen** aus dem Abschnitt oben (Messvorschläge S1–S17, Material-Bilder,
   Videos).
8. **Autorenschaft der älteren Commits:** 50 Commits tragen noch „Claude" als Autor, 56 als
   Committer. Das Umschreiben ändert alle Commit-Kennungen des Branches und braucht einen
   Force-Push; die Rechteprüfung dieser Sitzung hat es abgelehnt. Nach dem Umschreiben müssen
   die Commit-Verweise in Gesamtabnahme, Behebungsbericht und Doku-Bericht nachgezogen werden.
   `main` bleibt, wie es ist (Simon, 27.09.).

## Entscheidungen der Umsetzung, die Simon kippen kann

Vortags-Erinnerung zur gleichen Uhrzeit am Vortag (24 h ± 15 min) statt zu einer festen Tageszeit;
Konfis als Einladungsziel antworten wie unbekannte Kennungen (Team-Konten bleiben auffindbar); in
einer weiteren Gemeinde lassen sich nur Rolle und Jahrgänge ändern, Kontofelder bleiben bei der
Stamm-Gemeinde; Refresh-Gnadenfrist genau eine Wiederverwendung, die dritte widerruft alle Tokens
des Kontos; SMTP-Zertifikatsprüfung standardmäßig streng; Eck-Marken nur im Dunkeln abgesenkt, im
Hellen unverändert; Versionsnummern nur noch über `npm run version:setzen`.

Dazu vom 27.09.: Nachweisfotos der Anträge laufen durch dieselben Bausteine wie die übrigen Medien,
bleiben aber nie auf dem Gerät (sie liegen auf dem Server verschlüsselt und gehören meist
Minderjährigen; ein Leitungsgerät würde sie sonst sammeln); der Medien-Cache wird beim Abmelden
und beim Wechsel von Konto oder Gemeinde geleert; eine Konfi darf ihre eigene Buchung eines Events
weiter öffnen, auch wenn es inzwischen zu einem anderen Jahrgang gehört; die Fehlermessung
überträgt Server-Texte nur über eine Positivliste von 19 festen Anmeldetexten, alles andere als
Ersatztext der Stelle mit dem Status.
