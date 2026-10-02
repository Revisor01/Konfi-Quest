# Behebungsbericht zum Release-Audit 2.3.0

Stand 27.09.2026, abends (Code-Stand `9e7fa4c8`); Nachtrag 28.09.2026 (Abschnitt „Nacht zum 28.09.“), ausgeliefert als 2.3.0; Nachtrag 29.09.2026 (Abschnitte „29.09.: Pakete nach Simons Entscheidungen“ und „29.09., abends: Großpaket“, offene Punkte in `docs/audit/2026-09-28/offene-punkte.md`). Was seit der Gesamtabnahme vom 26.09. behoben
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
  ohne Netz; der Wartungstext auf allen Startseiten (`d7802549`; E-05). Am selben Tag auf einen
  wegklickbaren Hinweis mit „Später" umgestellt (Simon: „Keine Zwangsupdates"; Stand bei E-05).
- **Deploy-Falle:** Alle drei Deploy-Wege schickten Portainer eine leere Liste der
  Stack-Variablen; Portainer ersetzt sie damit. In Produktion folgenlos, weil die Werte direkt in
  der Stack-Datei stehen — jetzt gehen vorhandene Variablen unverändert zurück (`6cd0d52d`). Referenz-Compose: Fotoschlüssel und Doku-Passwort als Pflicht,
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

### Vor dem Merge (27.09., nachts)

Nach dem Produktionsbefund zu den Badges hat Simon die Prüfung aller Berichte gegen Code, Tests
und CHANGELOG angestoßen („filtern und mir alles sagen, was noch offen ist") und am Ende
entschieden: die kleinen Punkte vor dem Merge beheben, dazu vier Entscheidungen.

- **Badges nach der Rolle am Konto** (Produktionsbefund): Eine Leitung, die sich in Hennstedt als
  anwesend eintrug, bekam 12 Konfi-Badges von Kirchspiel West — die Prüfung las die Rolle am
  Konto, nahm ein Konfi-Profil aus einer Testgemeinde und verwechselte über `kp.*,
  u.organization_id` die Gemeinden. Jetzt: nur Konfis und Teamer:innen, nur in der Gemeinde, in
  der sie das sind, mit derselben Rollenregel wie App und `rbac.js`; „Teamer-Jahr" zählt nur die
  eigene Gemeinde; „Badge neu prüfen" wählt nach der Rolle in der Gemeinde (`c26ad08a` vom
  lokalen Agenten, `b6a67ed1`). Die 12 falschen Badges samt Mitteilungen hat der lokale Agent in
  Produktion gelöscht; bis 2.3.0 live ist, können sie bei derselben Konstellation wiederkommen.
- **Vollzugriff auf Termine** kam aus der Rolle der Stamm-Gemeinde: Wer zuhause Org-Admin und in B
  nur Teamer:in ist, durfte in B jeden Termin buchen. Jetzt die Rolle in der Gemeinde des Termins;
  Org-Admin über `user_organizations` bekommt den Vollzugriff jetzt auch (`4dd491b3`).
- **Fremde Konfi** bei Bonuspunkten, Aktivitäten und Event-Punkten: 404 statt 500 bzw. 200
  (`a614098f`; Sicherheit BF-11).
- **Passwort und Tokens im Konsolen-Log** bei fehlgeschlagener Anmeldung, beim Abmelden, bei
  Biometrie und beim Push-Token (`1a596d0e`; Grundgerüst BF-08, S-23).
- **Umfragen im Dunkelmodus** und das Zitat in der eigenen Blase: weiße Fläche mit heller Schrift
  (`42b336dd`, neuer Befund der Prüfung).
- **Hinweistext im Konfi-Formular** versprach ein später einsehbares Passwort (`7cb275f0`;
  Leitung BF-05). **Umlaute** in 9 weiteren Server-Meldungen, der Test liest jetzt auch
  Prüfregeln und Anfragegrenzen (`07db97ef`; UI BF-11).
- **Einladungen einsehen und zurückziehen** in der Benutzerliste (`88519074`; Leitung BF-02) —
  CHANGELOG und Handbuch versprachen es, die App hatte keine Oberfläche dafür.
- **Mindestversion** zeigt einen wegklickbaren Hinweis statt einer Sperre (`3df23705`; Simon:
  „Keine Zwangsupdates").
- **CHANGELOG, Store-Texte, Handbuch:** rund 80 Stellen in den Begriffen der App, Sätze, die mehr
  versprachen als der Stand, am Code berichtigt, Store-Texte auf Build 125/231, Rechte-Tabelle
  der Challenges, Ranking wie die App es zeigt, QR-Check-in durch Teamer:innen mit Grund
  (`13dfa7dc`, `8e7062b6`, `c565fa14`).
- **Kompatibilität mit der Store-App 2.2.0** — siehe den Abschnitt oben (`48c998cc`, `504acb29`).
- **Alle Berichte geradegezogen:** jeder Befund trägt eine Status-Zeile, geprüft gegen Code,
  Tests und CHANGELOG; veraltete Zeilen sind ergänzt, nicht gelöscht (`6902994a`, `b6bda5fb`,
  `446e73ac`).

Nach dem Öffnen des Pull Requests (Simon hat den Merge am 27.09. freigegeben) kamen aus dem CI
und aus der Prüfung vor dem Merge noch diese Punkte:

- **CHANGELOG ab 2.2.0 wiederhergestellt:** Der Versions-Commit `dd8cf2ad` hatte alle Abschnitte
  von 2.2.0 bis 1.0 abgeschnitten (2.628 Zeilen); sie stehen wieder so drin wie auf `main`
  (`24018560`). Überschrift `[2.3.0] - 2026-09-27` mit Build-Zeile (`3e8b0ef3`).
- **Frontend-Tests unter Node 26** (wie im CI): `localStorage` war dort `undefined`, 26 Tests der
  Medien-Pakete fielen; die Test-Einrichtung setzt den Speicher von jsdom ein (`1a0e6f23`).
- **CodeQL:** Werte aus der Anfrage stehen in keinem Fehler-Log mehr im Formatstring, 17 Stellen
  (`1a0e6f23`, `b88b0f26`). Die „DOM-Text als HTML"-Meldungen in Chat- und Challenge-Vorschau
  sind Fehlalarme (Blob-Adressen im `src` von Bild, Video, Ton) und bestehen auf `main` genauso.
- **Stopp direkt nach dem Start** endete nach 10 s mit Exit 1: Der Socket.IO-Adapter gab seinen
  LISTEN-Client nicht zurück, wenn der Stopp in seinen Verbindungsaufbau fiel, und `database.js`
  wertete den geschlossenen Pool als Startfehler. Jetzt Exit 0 (`bf92aa63`). Das war der
  „wackelnde" Shutdown-Test.

### Nacht zum 28.09.: Chat, Events, Jahrgänge, Leitung, Sitzung

Simons Auftrag vom 27.09. abends: „Chat und 1 und 2 machen" — das Nachladen im Chat und die
Punkte aus „Für 2.3.x vorgemerkt" (Events und Warteliste, Leitung und Team, Anmeldung und
Sitzung). Dazu seine Entscheidungen: Überbuchen ist gewollt; die Beförderung löscht weiter, aber
vorher entsteht eine dauerhafte Kopie der Konfi-Zeit; Events und Challenges, die nur an einem
Jahrgang hängen, gehen mit ihm, bei zwei Jahrgängen fällt nur die Zuordnung weg; Teamer:innen und
Leitung behalten ihre Stempel; Konfi-Badges bleiben; kein Gemeinde-Umschalter in
Detailansichten. Fünf Pakete in eigenen Arbeitsbäumen, jede Rückmeldung am Code geprüft, die
Commits einzeln übernommen. Zuerst als 2.4.0 gesetzt (MINOR: neue Funktionen, additive Parameter
und Routen, Migrationen 169–171); Simon am 28.09.: „alles noch als 2.3.0, denn wir sind gar nicht mit
2.3.0 live gegangen" — 2.3.0 war nur als Testbuild in TestFlight und im internen Test. Es bleibt
deshalb bei 2.3.0 mit den nächsten Build-Nummern.

- **Chat:** Ältere Nachrichten laden beim Hochscrollen nach, je 50, bis „Anfang des Chats"
  (`481206b7`; Screens BF-04; `GET /chat/rooms/:id/messages?before=`, Keyset auf
  `created_at, id`). Die Datei-Route nimmt das Token nur noch aus dem Kopf der Anfrage
  (`2d37c660`; Chat BF-09) — keine ausgelieferte App (1.5.3 bis 2.3.0) hat es je in der Adresse
  geschickt. Gelöschte Nachrichten stehen bei allen sofort als gelöscht da (`9b0432ac`).
- **Leitung und Team:** Ein Antrag lädt einzeln statt der ganzen Antragsgeschichte, die
  Detailansicht einer Konfi nur ihre offenen (`986d3262`; Leitung BF-04; dabei fiel auf, dass
  die Konfi-Ansicht mit `konfi_id` statt `user_id` filterte). Kein Gemeinde-Umschalter in der
  Event-Detailansicht der Teamer:innen; der Test prüft die Regel jetzt über alle Kopfzeilen
  (`d738374b`; Screens BF-05). Der Rückblick-Hinweis ist je Ausgabe wegklickbar (`d925ccac`;
  Screens BF-07). `DELETE /wrapped/teamer` nimmt die Ausgabe mit (`7a0e9339`; Chat BF-05).
  Die Einladungs-Mitteilung geht nach Zusage, Absage und Ablauf aus dem Postfach (`03dae260`);
  eine abgelaufene Einladung sperrt keine neue mehr — vorher 409 „steht bereits eine Einladung
  offen", obwohl niemand sie mehr sah (`a8f918cc`, Befund beim Prüfen des Pakets).
- **Jahrgang löschen und Beförderung:** Der Jahrgang geht in einer Transaktion und nimmt Events
  und Challenges mit, die nur an ihm hängen; „Nur Team" und „Nur das Team" bleiben, vergebene
  Punkte bleiben, die Stempel des Teams werden bewahrt (`bewahrte_stempel`, Migration 169);
  eine Vorschau nennt vorher die Zahlen (`42cc211c`; Punkte/Termine BF-08). Nebenbei: Der erste
  Termin einer Serie ließ sich nicht löschen (500). Die Beförderung legt vor dem Löschen der
  Buchungen eine Kopie der Konfi-Zeit an (`konfi_historie`, Migration 170), sichtbar in der
  Konfi-Historie und der Detailansicht der Leitung als „Events der Konfi-Zeit" (`c196c9a5`,
  `ee1a61c7`; BF-09).
- **Events und Warteliste:** Ende vor Beginn → 400, Serien übernehmen die Dauer (`ee01fc88`;
  Leitung BF-03). Die zweite Abmeldung antwortet 200 (`5d0b8f7b`; Punkte BF-03). `status` beim
  Eintragen von Hand wird geprüft (vorher 500 oder Buchungen mit beliebigem Status),
  Überbuchen bleibt erlaubt (`bdbccaee`; BF-04, Simon 28.09.). Eine Reihenfolge für die
  Warteliste: Wer sich neu anstellt, steht hinten, Liste und Detail zeigen denselben Platz;
  dabei fiel auf, dass das Herabstufen durch die Leitung den Platz leer ließ (`95083e1f`; BF-05,
  BF-11). Konfi-Plätze auf unbegrenzt lassen alle Wartenden nachrücken (`b70ae325`; BF-06).
  Teamer-Aktivitäten nur an Personen der eigenen Gemeinde (`39c915d0`; BF-07). Am Morgen danach
  hat Simon die offene Frage entschieden (Variante c): Das Bestätigen einer Wartenden bei vollem
  Event fragt „Trotzdem bestätigen?" und überbucht nach dem Ja (`ueberbuchen: true`, additiv;
  ohne das Feld bleibt die Ablehnung wie bisher, jetzt mit `error_code: 'event_voll'`). Gleich
  danach dieselbe Rückfrage beim Eintragen von Hand, für Konfis und Team getrennt (einmal je
  Kontingent für alle Übrigen); Store-Apps ohne das Feld überbuchen dort weiter still.
- **Anmeldung und Sitzung:** Der rotierte Refresh-Token liegt bei Biometrie nicht mehr im
  Klartext (`4e4d8d14`; Grundgerüst BF-06). Nach einem Refresh höchstens eine Wiederholung bei
  401 — gemessen vorher 8 Versuche und 7 Refreshs, jetzt 2 und 1 (`fb4b01d0`; BF-09). Der
  Refresh hat ein Zeitlimit von 20 s (`49d85b5d`; BF-07). Fehler der API tragen weder Tokens noch
  Anfragekörper ins Protokoll, zentral an einer Stelle statt in 102 Aufrufen (`c21cccff`).
  Refresh-Tokens sind an das Gerät gebunden (`8fedc664`, Migration 171; Sicherheit BF-08) —
  geprüft gegen 2.2.0 und 2.3.0: Beide schicken an Anmeldung, Registrierung und Refresh keine
  Geräte-Kennung, ihre Tokens bleiben ungebunden und gelten wie bisher. Formulare fallen bei
  einem Netzabbruch im Senden in die Warteschlange, wo das gefahrlos wiederholbar ist
  (`e8bcfd34`, `7311e96c`, `656f5610`; Grundgerüst BF-01 Teil 2).
- **Version** 2.3.0 (zuerst 2.4.0, `8d60fd50`; zurückgesetzt nach Simons Entscheidung), Android 127, iOS 233.
- **Beim Zusammenführen gefunden:** Die Liste „Termine der Konfi-Zeit" verstieß gegen die
  Begriffsregel (`ee1a61c7`); die Tabellen der Migrationen 169 und 170 fehlten in der
  TRUNCATE-Liste der Tests (`0807a1cb`); die neue Meldung „Das Ende liegt vor dem Beginn" fehlte
  in der Positivliste der Fehlermessung (`c3ce8c87`). Jeder Fund fiel in der vollen Suite auf,
  nicht in den Läufen der Pakete.
- **Tests am Ende:** Backend 212 Dateien / 4.232 Tests, Frontend 351 / 4.748, alle grün;
  Typprüfung und Lint ohne Fehler, `version:pruefen` gleich, Doku-Generatoren ohne Abweichung.

### 29.09.: Pakete nach Simons Entscheidungen

Simon, 28.09.2026, auf die Liste der offenen Befunde: „1-4 machen den rest für später. Aber
bewahren." Dazu seine Entscheidungen: „Konfi und Team geht nicht parallel. [...] Es bleibt immer an
der Gemeinde!", „Material wird global ja", „Gelöschte Badges müssen bei befördertem erhalten
bleiben. Auch wenn wir die zb ändern", „codes länger als 7 Tage ist gut. Mach es flexibel. Aber mit
Zwang die ablaufen zu lassen", „konto löschen muss wirklich alles löschen". Am 29.09. kamen seine
Rückmeldungen aus TestFlight 233 dazu (Postfach-Symbol, Reiterleiste, dritte Rollenfarbe,
Zähler, Android-Symbol) und ein Fehler in Produktion.

- **Fehler in Produktion (vorab ausgeliefert, #187, `dfd73e78`):** Team und Leitung ließen sich
  nicht von Hand zu Events hinzufügen — die Auswahl blieb leer. `jahrgang_ids` kam als Text-Array
  (pg liest `bigint[]` als Text), die App verglich streng. Dazu fehlten per Einladung
  Mitarbeitende in Team-Liste, Leitungsliste, Detailansicht und beim Eintragen. Seit 29.09.,
  03:28 live.
- **Paket 1 (Gemeinden):** Konfi und Team können auf keinem Weg mehr zugleich bestehen, auch nicht
  über Gemeindegrenzen; die automatische Löschung überspringt Altbestands-Mischkonten. Teamer-Badges
  und Zertifikate gelten je Gemeinde (keine 404 mehr in der weiteren Gemeinde). Gesprächsvorlage
  `docs/audit/2026-09-28/mehrfach-konten.md` mit acht Fragen; Messung `06-mischkonten.md`.
- **Paket 2 (Löschungen):** Material eines gelöschten Jahrgangs wird ausdrücklich global, die
  Vorschau nennt die Zahl. Konfi-Badges Beförderter kommen aus der Kopie der Konfi-Zeit und bleiben
  beim Löschen und Ändern eines Badges (Migration 172). Einladungscodes: Gültigkeit 7–90 Tage,
  Verlängern höchstens bis 90 Tage ab heute, abgelaufene bleiben abgelaufen. Konto löschen: eine
  gemeinsame Funktion für alle vier Wege nimmt alles der Person mit, auch Dateien und
  Zweiergespräche; was sie für die Gemeinde angelegt hat, bleibt ohne Namen (Migration 173); ein
  Wächter-Test fällt, wenn eine neue Tabelle keine Löschregel hat.
- **Paket 3 (App-Fehler, 16 Befunde):** unter anderem Doppeltipp auf „Anmelden", Sperrgrund statt
  „Sitzung abgelaufen", QR-Scanner, Ungelesen-Zahl im Chat, Wettlauf bei Challenge-Beiträgen,
  Punkteziel 0 wird abgelehnt (Simon: „Demnach ist ablehnen der 0 gut"), Pflicht-Events beim
  Anlegen in der Transaktion, Rückblick löschen nur mit Schreibrecht.
- **Paket 4 (Sicherheit und Datenschutz, 12 Punkte):** QR-Code nur für Events der eigenen
  Jahrgänge, Token ohne Name und E-Mail, Protokoll ohne Namen und Freitexte, Mail-HTML maskiert,
  400/413/415 statt 500, Text-Uploads geprüft, Aufräumskripte kennen die Challenge-Uploads,
  Namensprüfung begrenzt, fremde Kennungen 404. BF-13 wartet auf die Messung am Proxy
  (`07-client-adresse-hinter-dem-proxy.md`).
- **Paket F (Oberfläche):** Postfach mit blauem Punkt statt Umschlag, Reiterbeschriftungen nicht
  mehr abgeschnitten, eigene Farbe für die Leitung (Petrol), orange Zahlen mittig. Bei Challenges
  trägt das Symbol die rote Zahl baugleich zum Chat, das orange Eck-Badge Zahl und Uhr
  (Simon: „bei Challenge soll es baugleich zum Chat"; der Punkt ohne Zahl vom Morgen ist
  zurückgenommen, `1213773f`).
- **Paket G (Android):** App-Symbol in der sicheren Zone mit eigenem Hintergrund und
  Monochrom-Ebene; die Zahl am Symbol erreicht den Launcher (`<queries>`); die Leitung behält auf
  Android ihre Mitteilungen beim Öffnen. Am Gerät noch zu prüfen.

Simons Antworten vom 29.09. auf die Rückfragen zum PR:

- **Rolle „Org-Leitung“:** heißt überall „Gemeindeleitung“ („Ja bitte umbenennen“); „Org-Admin“
  und „Org-Wechsler“ gehen mit. Umsetzung im Begriffe-Paket.
- **Konto löschen:** Zweiergespräche verschwinden ganz, was die Person für die Gemeinde angelegt
  hat, bleibt ohne Namen — „genau so“.
- **Mitteilungen der Leitung:** „warum sollten die keine Benachrichtigungen behalten?“ — die App
  räumt beim Öffnen für keine Rolle mehr alles weg, auch auf dem iPhone nicht mehr (`e30fb0c2`).
- **Anmeldeprotokoll:** „doch sollen Protokoll schreiben“ — Fehlversuche stehen wieder im
  Server-Protokoll, mit Konto-Kennung, nie mit dem Namen (`23d3821b`).
- **Postfach:** „nur den Punkt! Das sieht sehr gut aus“ — der schlichte Punkt bleibt.
- **Zähler an der Challenge:** „baugleich zum Chat“ — rote Zahl am Symbol für jeden Beitrag, der
  wartet (Freigaben plus neue), dazu das orange Eck-Badge mit Zahl und Uhr (`1213773f`).

Alle Pakete mit Test und Gegenprobe je Befund; Zahlen in den Commit-Nachrichten und in den
Nachträgen der Berichte. Was offen bleibt, steht vollständig in
`docs/audit/2026-09-28/offene-punkte.md` — erstmals samt der Abschnitte „Unklar" und
„Nicht geprüft" und der Nebenbefunde vom 29.09.

### 29.09., abends: Großpaket — Pakete 5–8, App-Größe, Gerätetest

Simon, 29.09.2026: „Schnüre ein größeres Paket. Ich möchte möglichst alle Befunde schließen bevor
wir an die Features gehen. Auch die App Größe finde ich extrem wichtig anzugehen. Warum soll das
mit in der App liegen. Der Kontrast ist uns erstmal egal." Dazu am Nachmittag sein Gerätetest mit
Build 128 auf einem Sony Xperia 1 VI.

Zwölf Pakete (A, B1, B2, C, D, E, F, G2, H, I1, I2, I3) liefen parallel, jedes in eigenem
Arbeitsbaum mit eigener Test-Datenbank und demselben Auftrag wie bisher (Test und Gegenprobe je
Befund, CHANGELOG, Handbuch und API-Doku im selben Commit, Antwortformen unverändert, Migrationen
additiv). Die Commits wurden einzeln übernommen, danach die Leitplanken der Pakete gegeneinander
abgeglichen, die Generatoren und beide Vollsuiten gefahren. Von den 55 offenen Befunden sind 44
behoben, 8 teilweise (Rest begründet), 3 offen; Einzelheiten in
`docs/audit/2026-09-28/offene-punkte.md`.

- **App-Größe:** Handbuch, Bildschirmfotos, API-Referenz und Webseiten liegen nicht mehr in der
  App. Ein eigenes App-Verzeichnis nimmt aus `public/` nur, was die App lädt, und der Build bricht
  über 11 MB ab; die Release-Workflows prüfen die Kopie im nativen Projekt. Web-Inhalt der App
  45,7 → 9,2 MB (gemessen mit `cap copy`). Das Android-Paket fiel von 41,2 MB (versionCode 128)
  auf 9,2 MB (versionCode 129, gemessen im Release-Lauf, −77,6 %), das iPhone-Paket ebenso von
  41,2 auf 9,2 MB (Build 235, −77,6 %). Handbuch-Bilder als WebP, nur
  die eingebundenen; Symbole verlustfrei kleiner; der Build läuft ohne Warnungen.
- **Build, CI, Deploy:** Backend-Image aus dem Lockfile, ohne Dev-Pakete, Tests und Compiler
  (1,92 GB → 486 MB); eine Node-Linie (24 LTS) für CI, Images und `engines`; Backend-Lint und
  Typprüfung der Tests als CI-Schritte; alle Actions auf Commits festgenagelt; der Deploy rollt
  keinen älteren Stand über einen neueren; der Notfall-Deploy läuft über dasselbe Skript und hat
  einen Probelauf; Production im Play Store gestaffelt (Vorgabe 10 %); ein roter `main` legt ein
  GitHub-Issue an und schließt es bei Grün; jeder Store-Upload setzt einen Git-Tag; die CSP der
  Web-App ist scharf; Sitemap aus dem Inhalt; `apple-app-site-association` statt Platzhalter;
  iOS-Symbol ohne Alphakanal, Release-Push auf `production`, Dokumente-Ordner nicht mehr
  freigegeben.
- **Datenbank und Betrieb (Migrationen 174–178):** Wiederherstellung und Erst-Einrichtung auf einer
  frischen Instanz durchgespielt und als Skript; `settings` mit Primärschlüssel; neun doppelte
  Indizes weg; die TEXT-Zeitspalten als `timestamptz`; fünf Migrationen laufen auch ein zweites Mal;
  der Neuinstallations-Wächter vergleicht den ganzen Katalog; der Test-Dump wird reproduzierbar
  fortgeschrieben (0 statt 49 offene Migrationen); Push an viele schreibt Sammelzeilen ins Log;
  Massenmails gepoolt und gedrosselt; Refresh-Tokens schon beim Start aufgeräumt.
- **Tests:** E2E-Datenbank wie eine neue Instanz, Punkte-Test auf den konkreten Wert; jede
  Backend-Route hat einen Test; reine Quelltext-Tests 42,4 → 38,7 % der Dateien, eine Leitplanke
  lässt keine neuen zu; Komponenten ohne Test 49 → 12; feste Zeitzone; die roten CI-Läufe mit
  „deadlock detected" gingen auf `closePool` zurück.
- **Wer sieht was und Sicherheit:** Gemeinde löschen nutzt die gemeinsame Kontolöschung und nennt
  vorher, was mit den Konten geschieht; der Team-Rückblick zählt nur Team-Abzeichen; Teamer-Profil,
  Konfi-Badges der Leitung und die Jahrgangslöschung lesen die Rolle je Gemeinde; eigene Grenzen
  für `validate-invite`, `reset-password` und `refresh`; die Client-Adresse kommt ohne
  Proxy-Merkmal nicht aus `X-Forwarded-For`; die Event-Abmeldung trägt die Kennung und geht mit dem
  Konto.
- **Doku, Datenschutz, Oberfläche:** Die Datenschutzerklärung beschreibt Absturzberichte,
  Geräte-Kennung und Push-Inhalt so, wie der Code arbeitet; Absturzberichte lassen sich im Profil
  abschalten (Simon: „An, abschaltbar"); Handbuch „Eine neue Gemeinde einrichten"; lange Listen der
  Leitung rendern schrittweise; Kriterienfarben als Tokens; Dunkelmodus als Bildvergleich; tote
  Dateiverweise in Kommentaren mit Prüfung.
- **Simons Gerätetest (Xperia, Build 128):** Word-Dateien lassen sich senden (Dateien ohne Typ
  gehen nach ihrer Endung, eine Ablehnung nennt den Grund); Dateiauswahl und alle Links nach
  draußen lösen keine Biometrie-Abfrage mehr aus (eine Stelle je Weg, je mit Wächter-Test); das
  Mitteilungssymbol ist die Lutherrose statt eines weißen Flecks; nur noch ein FCM-Dienst, damit
  kommen Mitteilungen auch bei offener App an. **Zahl am App-Symbol** (Simon: „Ich will Android
  exakt gleich wie iOS", Wahl „Zahl wie iOS"): Android selbst kennt keine Zahl — Pixel zeigt
  technisch nur einen Punkt, die Zahl malen die Startbildschirme der Hersteller. Die App erkennt
  beim Start, welcher Weg gilt: Sony und Huawei über deren Zahl-Schnittstelle (ein eigener
  Push-Dienst setzt sie auch bei geschlossener App), Samsung und Xiaomi über die Zahl an einer
  Sammel-Mitteilung, die bei 0 verschwindet; nach jeder Mitteilung gleicht ein stiller Push die
  Zahl ab (Migration 185). Handbuch „Bedienung" mit Tabelle je Hersteller. Am Xperia noch zu
  prüfen.
- **Nach Simons Entscheidungen:** Chat-Mitteilungen nennen Absender und Art, nicht den Inhalt
  („Absender, ohne Inhalt"); bei einer Absage gilt auch eine abgemeldete Konfi als entschuldigt;
  die Serie zeigt den Fortschritt ehrlich; nodemailer 10; Gemeinde anlegen in einer Transaktion
  mit systemweit geprüftem Benutzernamen. Einladungscodes bleiben bei 8 Zeichen; abgesagte Events
  zählen als offene Buchungen weiter nur Konfis.

### 30.09.: Paket J — Nachzügler, Tests, Abhängigkeiten, Notfall-Probelauf

Simon, 30.09.2026: „Gibt es irgendwas das du erledigen könntest. Das wäre hilfreich." — Er wählte
alle vier Vorschläge. Drei Agenten liefen parallel (eigener Arbeitsbaum, eigene Test-Datenbank),
den Probelauf und die Zusammenführung machte die Koordination. Einzelheiten und Commits:
[offene Punkte, Paket J](../2026-09-28/offene-punkte.md#paket-j-30092026).

- **Notfall-Deploy geprobt** (erstmals auf GitHub): Rückrollweg auf den Stand vom 29.09. grün in
  24 s, Produktion unverändert. Der Lauf mit leerem Tag brach sicher ab, weil „leer" den letzten
  Commit nahm und der nur Doku war; jetzt nimmt er den jüngsten Stand mit gebauten Images.
- **Benutzernamen:** gleichzeitige Anlagen (fünf Routen), Umbenennen und Registrierung prüfen
  systemweit unter einer Sperre je Namen — vorher gemessen doppelt vergeben bzw. mehrdeutig.
- **Kleinere Fehler:** Serienanlage und neun Hilfsfunktionen ohne gleichzeitige Abfragen auf einem
  Client; Systemname der Gemeinde mit Umlauten und beim Bearbeiten stabil; Mitglieder-Fenster ohne
  403 für Konfis; API-Doku zu Gemeinde und Benutzer:innen auf dem Stand des Codes.
- **Tests:** keine Komponente mehr ohne Test (vorher 10), Quelltext-Tests 150 → 117; ein
  wackelnder Mail-Test gemessen und robust gemacht.
- **Abhängigkeiten:** sechs der sieben Dependabot-PRs übernommen (vitest 5, js-yaml 5, Playwright,
  setup-java 6, Backend minor/patch); das Web-Bundle bleibt byte-gleich. #195 (nativer Code) wartet
  bis nach dem Store-Release. Die zwei moderaten Meldungen auf `main` (react-router) sind nicht
  behebbar und für die App ohne Wirkung — [offene Befunde Nr. 15](../../offene-befunde.md).
- **Geprüft und bewusst nicht geändert:** `@capacitor/status-bar` wirkt nativ (Statusleiste
  antippen, Android-Randlage) und bleibt, bis es am Gerät geprüft ist.

## Was offen bleibt

**Stand 29.09.2026, abends:** Die vollständige Liste steht in
`docs/audit/2026-09-28/offene-punkte.md`, jeder Eintrag mit seinem Stand. Von 55 Befunden sind 44
behoben, 8 teilweise und 3 offen: die Deploy-Lücke (braucht den Server, Auftrag 10), die
Screenshots (nach dem Deploy, Auftrag 08) und der Kontrast im Hellmodus (von Simon zurückgestellt).
Von 24 Punkten aus „Unklar"/„Nicht geprüft" sind 12 geklärt oder behoben; der Rest sind Messungen
in Produktion, Fragen an Simon und die Datenauskunft (Feature E-21). Danach kommen die 23
Feature-Empfehlungen. Die Abschnitte hier unten sind der Stand vom 27./28.09. und bleiben zur
Nachverfolgung stehen.

Stand 27.09.2026, vor dem Merge. Gezählt aus den Status-Zeilen der 15 Bereichsberichte und des
Audits „Wer bekommt was": **238 Befunde, 125 behoben, 22 teilweise, 79 offen, 8 bewusst so
gelassen, 4 beim Betrieb.** Kein KRITISCH- oder HOCH-Befund ist offen; die offenen sind MITTEL
und NIEDRIG. Dazu kommen rund 100 Punkte, die nur in Produktion oder am Gerät zu klären sind.
Die Einzelheiten stehen je Befund in den Berichten.

**Entschieden (Simon, 27.09.):** Farben (die verbleibenden Stellen bleiben: eigene Chat-Blase,
Kopfbanner der Event-Details, „Event absagen" auf dunkler Karte, Bereichsfarben als Schrift im
Hellmodus, „Passwort vergessen?"); Begriffe (Events, Badges, Challenges, Stempel); kein
Betriebs-Kapitel im Handbuch; Mitteilungen an die Leitung nur nach Jahrgang; Entfernen statt
Löschen bei weiteren Gemeinden; Einladungen zurückziehen gebaut; Ranking bleibt, das Handbuch
beschreibt es; keine Zwangsupdates; Teamer:innen erzeugen QR-Codes, damit mehrere gleichzeitig
einchecken können.

### Nach dem Deploy (Betrieb, `docs/auftraege/lokaler-agent/`)

- Phase B–D der Ablaufliste: Deploy beobachten, `RUN_BACKGROUND_JOBS=false` bei `backend2`
  entfernen, `backend-test` in Portainer von Hand auf `test-latest` stellen und
  `test-backend.yml` laufen lassen (erst dann gilt die Anmeldesperre auch dort), echte Mail,
  Testbuilds (Android nur `internal`), CHANGELOG-Überschrift `## [2.3.0] - Datum` mit Build-Zeile
  und Git-Tag `2.3.0`, Screenshots neu ziehen (Auflage 22), Umami bereinigen.
- **Messen:** Konten mit verschiedenen Rollen in verschiedenen Gemeinden (Umfang für den Block
  „Rolle je Gemeinde" unten); Konfis, deren Profil-Gemeinde weder Stamm- noch Zusatzgemeinde ist
  (vor dem Deploy, wegen `a614098f`); Konfis ohne Jahrgang; aktive Pflicht-Events ohne Jahrgang;
  Push-Tokens ohne `app_version`; ungelesene Mitteilungen je Person; Schlüssel je Limiter in
  `rate_limit_zaehler` (IP-Grenzen je Adresse); `idx_scan` der Indizes; Schema der Test-Datenbank
  gegen Produktion (Dump 5 Wochen alt); Erinnerungszeiten und Laufzeiten; Log-Volumen.
- **Am Gerät:** Funkloch (Flugmodus), VoiceOver/TalkBack, Schrift „Größt", Dunkelmodus am iPhone
  (Auflage 18a), Kaltstart-Blitz, Statusleiste.

### Für 2.3.x vorgemerkt (MITTEL)

- **Rolle je Gemeinde:** rund 20 Stellen lesen Rolle oder Gemeinde nur am Konto — Kontingente für
  Konfi- und Team-Plätze, automatische Löschung (wer zuhause Konfi und woanders im Team ist,
  würde ganz gelöscht), Jahrgangs-Chat, Konfi-Rückblick, Badges und Zertifikate von
  Teamer:innen der Zweitgemeinde (404), Challenge-Autor:innen, Pflicht-Einschreibung, Pushes
  (Liste mit Fundstellen: Fachlogik Punkte/Termine, Nachtrag „Rolle je Gemeinde"). Betroffen sind
  nur Konten mit verschiedenen Rollen in verschiedenen Gemeinden; zuerst messen.
- **Anmeldung und Sitzung:** Refresh-Token bei Biometrie nach der Rotation wieder im Klartext
  (Grundgerüst BF-06), Refresh ohne Zeitlimit (BF-07), keine Sperre gegen eine 401-Schleife
  (BF-09); 102 weitere Log-Aufrufe geben rohe Fehlerobjekte samt Zugangs-Token aus — zentral in
  `api.ts` schwärzen; Formulare fallen bei einem Netzfehler nicht in die Warteschlange (BF-01
  Teil 2); Refresh-Token ohne Gerätebindung (Sicherheit BF-08). **Behoben 28.09.2026** (Abschnitt
  „Nacht zum 28.09." oben).
- **Chat:** nur die letzten 100 Nachrichten, kein Nachladen (Screens BF-04); Datei-Token im Query
  (Chat BF-09). **Behoben 28.09.2026.**
- **Events und Warteliste:** Ende vor Beginn möglich (Leitung BF-03); Überbuchen beim Hinzufügen,
  `status` → 500 (Punkte BF-04); Wartelistenrang bei Wiederanmeldung (BF-05); Kapazität 0 lässt
  die Warteliste stehen (BF-06); Teamer-Aktivität an eine fremde Gemeinde (BF-07); Jahrgang
  löschen macht dessen Pflicht-Events gemeindeweit sichtbar und läuft ohne Transaktion (BF-08);
  Beförderung löscht vergangene Teilnahmen (BF-09); zweite Abmeldung ohne Netz → 400 (BF-03).
  **Behoben 28.09.2026**; Überbuchen beim Hinzufügen bleibt nach Simons Entscheidung erlaubt,
  nur der ungeprüfte `status` ist behoben.
- **Leitung und Team:** Antrag lädt die ganze Historie (Leitung BF-04); Umschalter in der
  Teamer-Detailansicht (Screens BF-05); Rückblick-Hinweis für Teamer:innen ohne Ausgabe (BF-07);
  leere Team-Ausgabe sperrt die Neuerzeugung (Chat BF-05). **Behoben 28.09.2026.**
- **CI und Werkzeug:** Backend-Image (root, `npm install pg`, keine `.dockerignore`), eine
  Node-Version, Backend-Lint, `node-fetch` deklarieren, Handbuch-Bilder (33 MB) aus dem
  App-Bundle, CSP-Header, Play-Upload nicht sofort zu 100 %, Meldung bei rotem `main`, Tests für
  `release-gate.py` und `rollend.sh`; Quelltext-Tests
  (44 %) und E2E über Smoke hinaus; Sitemap reproduzierbar.
- **Betrieb:** Log-Volumen (Betrieb BF-11), letzte Laufzeit je Job (BF-10), Obergrenze der
  Refresh-Tokens je Konto (abgelaufene und widerrufene räumt `auth.js` schon weg; 1.232 offene
  auf 129 Konten, größte 189), Sicherung als Dienst im Stack statt Host-Skript.
- **Zeitzone:** Produktion läuft in UTC; 24 Spalten ohne Zone und vier `CURRENT_DATE`-Stellen
  (zwischen 0 und 2 Uhr Berliner Zeit der Vortag). Lösung: `timestamptz` (Muster Migration 138),
  `TZ` bis dahin nicht setzen.

### Löschungen als Ganzes prüfen (Simon 28.09.: „Wir müssen die Löschungen irgendwann nochmal anschauen.")

Am 28.09. behoben: Jahrgang löschen nimmt Events und Challenges mit, die nur an ihm hängen, in
einer Transaktion (Punkte/Termine BF-08); die Beförderung legt vorher eine Kopie der Konfi-Zeit an
(BF-09). Dabei sind diese Löschwege begegnet — jeder mit eigener Regel, was mitgeht und was
bleibt:

- **Event** (`DELETE /events/:id`, `utils/terminLoeschen.js`): Chat, Buchungen, Zeitfenster,
  Postfach; Punkte werden zurückgenommen, Absage-Push. Dieselben Schritte beim **Jahrgang**, dort
  ohne Punkte-Rücknahme und ohne Push. Die App löscht Serien mit parallelen Anfragen — seit
  28.09. hinter einer Sperre je Gemeinde.
- **Jahrgang** (`DELETE /admin/jahrgaenge/:id`, `utils/jahrgangLoeschen.js`): Chat, Events und
  Challenges nur dieses Jahrgangs; Profile Beförderter nur gelöst; Rückblicke bleiben.
  **Offen:** Material des Jahrgangs verliert per Kaskade seine Zuordnung und ist danach für das
  ganze Team sichtbar (`material.js`, „ohne Jahrgang“) — dieselbe Klasse wie BF-08;
  Einladungscodes gehen per Kaskade mit.
- **Challenge** (`DELETE /challenges/admin/:id`, `utils/challengeLoeschen.js`): Beiträge, Dateien,
  Postfach und die Stempel aller. Nur beim Jahrgang bleiben die Stempel des Teams
  (`bewahrte_stempel`). Einzelne Beiträge (`/konfi/submissions/:id`, `/admin/submissions/:id`)
  nehmen den abgeleiteten Stempel mit.
- **Badge** (`DELETE /badges/:id`): nimmt alle verliehenen Exemplare aus `user_badges` mit — auch
  die „hart gespeicherten“ Konfi-Badges Beförderter; nur die Kopie der Konfi-Zeit hält sie fest.
- **Konfi/Konto** (`DELETE /admin/konfis/:id`, Selbstlöschung, automatische Löschung nach der
  Konfirmation: 60 Tage weich, 120 Tage hart; `utils/konfiDeletion.js`): Konfi-Zeit und bewahrte
  Stempel gehen mit dem Konto (ON DELETE CASCADE).
- **Beförderung** (`promote-teamer`): Buchungen und offene Anträge; seit 28.09. vorher die Kopie.
- **Gemeinde** (`DELETE /organizations/:id`): alles, einzeln aufgezählt.
- **Aktivität, Kategorie, Level**: blockieren, solange etwas daran hängt (409).
- **Chat** (Raum, Verlauf, Nachricht), **Material**, **Rückblick-Ausgaben**, **Bonuspunkte und
  zugeordnete Aktivitäten** je eigene Routen.

Leitfrage für den Durchgang: Was ist Verlauf (bleibt als Kopie), was ist Zustand (geht mit), und
wer erfährt es — heute beantwortet jede Route das selbst.

**Entschieden und umgesetzt 29.09.2026** (Simon, 28.09.): Material eines gelöschten Jahrgangs wird
global; Konfi-Badges Beförderter bleiben beim Löschen und Ändern eines Badges; Konto löschen nimmt
auf allen vier Wegen alles der Person mit, eine gemeinsame Funktion mit Wächter-Test;
Einladungscodes bleiben der Gemeinde. Offen: Gemeinde löschen nutzt die gemeinsame Funktion noch
nicht (siehe `docs/audit/2026-09-28/offene-punkte.md`).

### Später (NIEDRIG)

Die NIEDRIG-Befunde der Berichte ohne Paket — unter anderem Tipp-Anzeige, zwei
Ungelesen-Zähler, E-Mail-HTML roh, Doppeltipp auf „Anmelden", QR-Scanner-Closure,
Body-Parser-Fehler → 500, JWT mit E-Mail, `check-username` ohne Limiter, Aufräumskripte ohne
`uploads/challenges`, Text-Uploads ohne Inhaltsprüfung, redundante Indizes, `settings` ohne PK,
Kommentar- und Zahlen-Drift, Dependabot-Regeln, 1,39-MB-Icon-Chunk, 17 Flächen-Hexwerte der
Kriterien, dunkle Screenshots; die Einladungs-Mitteilung im Postfach der eingeladenen Person
bleibt nach Annehmen, Ablehnen oder Ablauf stehen (nach dem Zurückziehen verschwindet sie) —
**behoben 28.09.2026** (`03dae260`).

### Vor der EKD-Ausrollung

Datenschutzerklärung (mehrere Gemeinden, Crashlytics), Verarbeitungsverzeichnis, TOM, AVV;
Absturzdiagnose abschaltbar; Chat-Texte im Push an Firebase/Apple klären; Datenauskunft nach
Art. 15; Melden und Blockieren im Chat, falls die Store-Prüfung es verlangt; Sicherung mit
Rückspielprobe üben, Notfall-Deploy proben; Lasttest (Sockets, Node-Speicher); Universal Links
(AASA-Platzhalter; eingeschaltet 02.10.2026, ab iOS-Build 240); Feature-Empfehlungen E-01 bis E-04, E-06 bis E-08 und die zehn offenen
Produktfragen.

## Was bei Simon liegt

1. **Apple-Schlüssel** `7AQA623H3T` und `A29U7SN796` — am 27.09. widerrufen, erledigt.
2. **Phase A** (Sicherung, Mail-Zertifikat, Zählungen, Postgres 2 CPU / 3 GB, Pool 50,
   `pg_stat_statements`, Umgebung der Backends) — vom lokalen Agenten am 27.09. erledigt
   (`docs/auftraege/lokaler-agent/01`, `02`). Die Werte stehen direkt in der Stack-Datei; auf
   Stack-Variablen umstellen erst nach dem Merge mit dem neuen Deploy-Workflow.
3. **Den Merge freigeben.** Danach Phase B–D (Abschnitt oben).
4. **Entscheidungen, die noch offen sind:** Nutzungsmessung S1–S17 (`docs/messung/umami.md`);
   Material-Bilder beim Hochladen verkleinern oder nicht; Videos (Empfehlung: so lassen); die
   zehn Produktfragen der Feature-Empfehlungen; Universal Links (entschieden 02.10.: noch in
   2.3.0). Am 28.09. gestellt und
   **entschieden:** Das Bestätigen einer Wartenden bei vollem Event fragt nach und bestätigt dann
   trotzdem (Simon: „C bitte", Variante c) — gebaut am 28.09., siehe Abschnitt „Nacht zum 28.09."
5. **Autorenschaft älterer Commits:** Ein Teil des Branches trägt noch „Claude" als Autor.
   Umschreiben ginge nur mit Force-Push und neuen Commit-Kennungen; bleibt, wie es ist, solange
   Simon nichts anderes sagt. `main` bleibt, wie es ist (Simon, 27.09.).
6. **Aus dem Großpaket vom 29.09.:** Rückfragen und die Gerätekontrolle der Android-Zahl stehen in
   `docs/audit/2026-09-28/offene-punkte.md`, Abschnitte „Bei Simon" und „Messen in Produktion und
   am Gerät". Entschieden hat Simon am 29.09.: Chat-Mitteilungen „Absender, ohne Inhalt";
   Absturzberichte „An, abschaltbar"; offene Buchungen abgesagter Events „Nur Konfis, wie heute";
   roter `main` → „GitHub-Issue automatisch"; Git-Tag je Store-Upload „Ja, automatisch"; CSP
   „Sofort scharf"; nodemailer 10 „Ja, jetzt übernehmen"; Absage bei abgemeldeter Konfi „Auch sie
   wird entschuldigt"; Serie „Fortschritt ehrlich zeigen"; Einladungscodes „Bei 8 bleiben"; bei
   Zahl 0 auf Samsung und Xiaomi „Ja, bei 0 wegräumen"; Android-Zahl „Zahl wie iOS".

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

Dazu vom 28.09. (Nacht): Der Chat lädt je 50 ältere Nachrichten, eine unbekannte oder fremde
`before`-Kennung liefert eine leere Liste statt eines Fehlers; das Token in der Adresse der
Datei-Route ist ganz entfallen statt nur für neue Apps; ein Antrag einer anderen Gemeinde
antwortet 404, einer eines fremden Jahrgangs 403; das Löschen eines Jahrgangs blockiert nicht
wegen Events oder Challenges, sondern nimmt sie mit (die App nennt vorher die Zahlen, ältere Apps
fragen ohne Zahlen), ohne Absage-Mitteilung an Angemeldete künftiger Events und ohne Rücknahme
vergebener Punkte; bewahrt werden die Stempel des Teams nur beim Löschen eines Jahrgangs, nicht
beim Löschen einer einzelnen Challenge; die Konfi-Zeit sieht auch eine Leitung ohne
Jahrgangszuweisung; Serien übernehmen die Dauer des ersten Events; wer von der Leitung auf die
Warteliste zurückgesetzt wird oder nach einer Absage wieder zusagt, stellt sich hinten an; der
Wartelistenplatz zählt nur die eigene Warteliste (Kontingent und Zeitfenster); eine fehlende
Geräte-Kennung beim Refresh eines gebundenen Tokens zählt wie eine falsche (401, nur dieses Token
wird widerrufen, nicht alle Geräte); scheitert der Refresh ohne Antwort des Servers, bleibt die
Sitzung bestehen statt „Sitzung abgelaufen"; online fallen nur PUT, DELETE und ausdrücklich
wiederholbare POSTs bei einem Abbruch in die Warteschlange, Anlegen bleibt beim Fehler.
