# Offene Befunde

Die eine Stelle für alles, was offen ist: Fehler und Lücken, Entscheidungen
bei Simon, Geplantes und Zurückgestelltes. Oben steht die **Arbeitsliste**
— was gerade läuft, worauf wir warten, was als Nächstes kommt —, darunter
die ausführlichen Einträge, auf die sie verweist. Was erledigt ist, wird
hier gestrichen — es bleibt in der Git-Historie und in der Commit-Nachricht.

- **Erledigt?** Eintrag unten löschen, in der Arbeitsliste abhaken und unter
  „Erledigt seit dem letzten Release" mit Datum und PR oder Commit
  vermerken; im Commit sagen, womit er erledigt ist.
- **Neu?** Unten eine Zeile mit Was, Warum und Seit wann; dazu genug Kontext,
  dass die nächste Sitzung ohne Vorwissen anfangen kann. In die
  Arbeitsliste kommt er, sobald jemand daran arbeitet oder er als Nächstes
  dran ist.
- **Keine Nummern.** Verweise aus Code und Doku nennen den Titel eines
  Eintrags, nicht seine Stelle in der Liste.
- Kennungen wie „Sicherheit BF-10" verweisen auf das Release-Audit vom
  26.–28.09.2026; wo es steht, erklärt
  [docs/README.md](README.md#befundkennungen).

Stand: 08.10.2026, gegen Code, Git und die Stores geprüft.

## Arbeitsliste

Je Punkt ein Satz und der Verweis auf den ausführlichen Eintrag, den Plan
oder den Auftrag. Abhaken, wenn der Branch auf `main` ist bzw. die Sache
erledigt ist.

### In Arbeit

Nichts.

### Wartet auf Gerät oder Simon

- [ ] **Maltes Gerätetest Android versionCode 135** (interner Testtrack seit
  08.10.2026) — Rückmeldung je Prüfpunkt aus
  [Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md), Schritt 4.
- [ ] **VoiceOver, Sprachsteuerung und größte Schrift am iPhone** —
  Voraussetzung für die Barrierefreiheitsangaben bei Apple
  ([Release](#release), „Barrierefreiheitsangaben im App Store").
- [ ] **Support-Probelauf mit Vorgängen** — angehalten nach Schritt 1
  (10.10.2026): Die Support-Mail ist aus, und die Probe-Anfrage 1 ist
  gelöscht; weiter, wenn die Stack-Variablen zurück sind
  ([Betrieb](#betrieb), „Support-Mail seit 08.10.2026 aus"),
  [Auftrag 16](auftraege/lokaler-agent/16-support-vorgaenge-probelauf.md).
- [ ] **Simons offene Fragen** — unten unter
  [Bei Simon zu entscheiden](#bei-simon-zu-entscheiden).

### Als Nächstes

- [ ] **Release 2.4.0** — Bildschirmfotos der Challenges erneuern
  ([planung/2.4.0.md](planung/2.4.0.md#1-challenges-als-eigene-seiten-wie-events)),
  ausliefern mit 2.4.0 ([Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md),
  Schritt 5), danach die Haken in der Play Console prüfen ([Release](#release),
  „Play Console empfiehlt vier Änderungen"); Ablauf in
  [betrieb/release.md](betrieb/release.md).
- [ ] **Web-Version: was noch fehlt** — Leiste „Verwaltung", Rückweg ohne
  Gemeinde, Kennzahlen, Einwilligung am Profil
  ([planung/web-version.md](planung/web-version.md#offen)); Zuweisung von
  Vorgängen und Bildschirmfotos im Support-Formular
  ([planung/support-vorgaenge.md](planung/support-vorgaenge.md)).
- [ ] **Feature-Empfehlungen vor der EKD-Ausrollung** —
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md).

### Später (entschieden)

- **DSGVO- und EKD-Unterlagen vor der Ausrollung** — Simon, 08.10.2026:
  „machen wir später" ([Zurückgestellt](#zurückgestellt), „Rechenschaft vor
  der EKD-Ausrollung").
- **Tablet-Fassung über die Web-Version** — Simon, 08.10.2026: „bisher nur
  hochformat, aber die web version … könnte eine tablet version werden". Die
  Apps bleiben im Hochformat; der Play-Hinweis „feste Ausrichtung" bleibt
  damit bewusst offen ([Release](#release)).

### Erledigt seit dem letzten Release

Seit 2.3.0 (Tag `2.3.0` auf `dac246eb`). **Wird beim Release 2.4.0
geleert** — der Beleg bleibt in Git und im CHANGELOG.

- [x] 03.10.2026 — 2.3.0 in beiden Stores: iOS freigegeben und live, Android
  (134) auf 100 % (Auftrag 13, `145270d0`).
- [x] 03.10.2026 — Repo aufgeräumt, 2.4.0 begonnen, veraltete
  Schema-Kommentare und der Biometrie-Schalter entfernt (#217, `4cc24f0e`).
- [x] 03.10.2026 — Web-Version mit Support-Ansicht und Anfrageformular,
  Challenges als Seiten, Rollenfarben, Support-Konten (#218, `4d5381a7`);
  TestFlight-Build 241 (Tag `2.4.0+ios.241`).
- [x] 03.10.2026 — Support-Mail (#219, `821e16e6`) und Support-Ansicht als
  Web-Oberfläche (#220, `2a282965`); Test-Gemeinden intern, Probe-Anfrage
  (Auftrag 15, `48f5c197`).
- [x] 06.10.2026 — Web-Ansicht aller Bereiche und Support-Vorgänge (#225,
  `e7357805`); Rollenfarbe der Filter, Konfi-Filter, Benachrichtigungen
  (#226, `c0445bd8`).
- [x] 07.10.2026 — gleicher Aufbau der Detailseiten, Liste/Kacheln (#227,
  `8d12dfd1`); Personenseite, Kacheln, Angaben mit Symbolen (#229,
  `fb07f831`); Listen sortierbar, Antrags-Entscheidung antwortet vor den
  Pushes (#230, `84363fe6`).
- [x] 08.10.2026 — Android-Gradle-Plugin 9.2.1, Gradle 9.5.1 (#231,
  `e48a7dd1`); versionCode 135 im internen Testtrack (`7741a3fc`, Tag
  `2.4.0+android.135`); Gradle-Schreibweise für Gradle 10 (#232,
  `8ef310f3`).
- [x] 08.10.2026 — Entscheidungen Simons: Chat-Mitteilungen ohne Inhalt
  bleiben (am Code bestätigt: nur Absender und Art,
  `backend/utils/pushText.js`); „Nachricht melden" wird nicht gebaut, weil
  jeder Chat moderiert ist (E-15 in
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md));
  Test-Backend abschaffen; Mehrfach-Konten-Fragen beantwortet;
  DSGVO/EKD-Unterlagen, „Darf freigeben" und Tablets später.
- [x] 08.10.2026 — Arbeitsliste oben in dieser Datei (`docs/arbeitsliste`).
- [x] 08.10.2026 — CodeQL #138, Schalternamen im Regex vollständig maskiert
  (`fix/codeql-138-regex`, PR #233).
- [x] 08.10.2026 — Test-Backend im Repo abgebaut: Dienst aus der
  Referenz-Compose, Workflow und `api_url`-Eingabe entfernt; die fünf
  TestFlight-Builds, die darauf zeigten, sind abgelaufen
  (`chore/test-backend-abschaffen`); die Server-Seite folgte am selben Tag.
- [x] 08.10.2026 — Zeitgeber und Horcher enden mit ihrer Seite (alle Stellen,
  mit Wächtertest), Zähler-Abruf nach Chat-Nachrichten entprellt (Betrieb
  BF-08), doppelte CSS-Klassen der Bereichs-Stylesheets aufgelöst,
  Filterzeile der Challenges bei 1366 px einzeilig, `armv7` aus der
  Info.plist (CI BF-15) (`fix/zeitgeber-aufraeumen`).
- [x] 08.10.2026 — kein Bearbeiten-Knopf bei Super-Admin-Konten, erlaubter
  Fall für Löschen und Jahrgangszuweisung durch Super-Admins im Test,
  Zeichenregel für den Benutzernamen der Gemeindeleitung, eigene Mail nach
  „Passwort setzen" für Support-Konten, Punktart am Beleg (Migration 200),
  CodeQL #128, Wiederholungsschutz für Bonuspunkte und einzelne Events
  (Migration 201); CodeQL #124 und #127 am Code als Fehlalarme begründet
  (`fix/offene-backend-fehler`).
- [x] 08.10.2026 — Mehrfach-Konten abgeschlossen: Event-Chat nach der
  Gemeinde des Termins, Push mit Gemeinde zwingend, Urheber:innen und
  Detailansicht aus anderen Gemeinden, Stamm-Zeilen angeglichen,
  Funktionsbezeichnung, „Teamer seit" und Sperre je Gemeinde, Löschen durch
  die Leitung beendet nur die eigene Mitgliedschaft, Rolle in
  Termin-Teilnehmern und Chat-Nachrichten und Gemeindeleitung beim
  Bearbeiten einer Gemeinde aus der aktiven Gemeinde, Sperre wirkt sofort
  auf beiden Replicas (Sicherheit BF-10), Gemeinde-Rückfall lädt Rolle und
  Namen neu (Grundgerüst BF-05) (`feat/mehrfach-konten-abschluss`;
  [planung/mehrfach-konten.md](planung/mehrfach-konten.md#umsetzung-stand-08102026)).
- [x] 08.10.2026 — Push, Postfach-Eintrag und Mail nach der Antwort stehen
  als Auftrag in einer dauerhaften Warteschlange (Migration 202) und
  überleben einen Neustart (`feat/nachantwort-warteschlange`;
  [betrieb/routinen.md](betrieb/routinen.md#nachlauf-warteschlange)).
- [x] 08.10.2026 — Wiederholungsschutz auch für Event-Serien (eine Kennung
  je Serie am ersten Termin) und die Konfi-Anlage (Migration 203; eine
  Wiederholung liefert dasselbe Konto mit neuem Einmalpasswort, solange es
  sich nie angemeldet hat, sonst 409); Schema-Dump bis 175 fortgeschrieben
  (Grundgerüst BF-02, Rest; `fix/wiederholungsschutz-serien-konfis`).
- [x] 08.10.2026 — Warteschlange erweitert nach Simons drei Ja: die Mail
  „Passwort vergessen" ist ein Auftrag (Token entsteht erst im Auftrag und
  steht nie in der Datenbank), `GET /api/status` meldet `nachlauf`
  `{haengend, fehlgeschlagen}` (additiv, nicht in `checks`), die Ablage im
  Gesendet-Ordner ist ein eigener Auftrag mit dem Mailquelltext
  (`feat/warteschlange-erweitern`;
  [betrieb/routinen.md](betrieb/routinen.md#nachlauf-warteschlange)).
- [x] 08.10.2026 — Reste der Mehrfach-Konten: Feed-Push an Konfis über beide
  Quellen der Zugehörigkeit, Gegenprobe zur Push-Sperre im Chat-Versand,
  beim Entfernen eines Konfi-Mischkontos gehen die Konfi-Daten dieser
  Gemeinde mit, Chat-Export mit der Rolle in der Gemeinde des Raums; die
  Leitung trägt Team aus einer anderen Stamm-Gemeinde wieder vom Termin aus
  (`fix/mehrfach-konten-reste`).
- [x] 08.10.2026 — Status-Spalten der Web-Tabellen sortieren in der
  fachlichen Reihenfolge, Offenes zuerst (Simon: „umsetzen"); die Reihen
  aller Status-Spalten an einer Stelle, `frontend/src/utils/statusReihenfolge.ts`
  (`feat/status-spalten-sortierung`).
- [x] 08.10.2026 — Test-Backend auch am Server abgebaut: Dienst aus dem
  Live-Stack, Traefik-Regel, KeyHelp-vHost, DNS-Eintrag und Registry-Tags
  entfernt (Server-Agent; `test-api` antwortet nicht mehr).
- [x] 08.10.2026 — CodeQL #124 und #127 auf GitHub als „False positive"
  geschlossen (globaler Limiter per `app.use`, Upload-Limiter an der
  Beitrags-Route in `backend/createApp.js`).
- [x] 08.10.2026 — Stamm-Rolle an weiteren Stellen (Mehrfach-Konten), nach
  Simons Entscheidungen: Schutz der letzten Gemeindeleitung zählt beide
  Quellen (Löschen durch die Leitung und Selbstlöschung), jede Gemeinde setzt
  das Passwort ihres Teams (Einmalpasswort, `reset-password`), Live-Updates
  an eine Person nach der Rolle in der Gemeinde des Inhalts, Jahrgang mit
  Team aus einer anderen Stamm-Gemeinde anlegen, Teamer-Rückblick („Dein
  Team", `/team-jahre`), Teilnehmende in der Konfi-Sicht, Hintergrundlauf
  bei gesperrter Stamm-Gemeinde, Schutz der Gemeindeleitung im
  Jahrgangs-Chat mit Sperre je Gemeinde (`fix/stamm-rolle-weitere-stellen`).
- [x] 09.10.2026 — „Darf freigeben" gebaut nach Simons Entscheidungen vom
  selben Tag: drei Rechte je Jahrgang (Anträge entscheiden, Events verbuchen,
  Challenge-Beiträge freigeben, Migration 204, Vorgabe an), vergeben von der
  Gemeindeleitung ([planung/darf-freigeben.md](planung/darf-freigeben.md),
  Branch `feat/darf-freigeben`).
- [x] 09.10.2026 — „Darf freigeben" für Teamer:innen: das Recht
  „Challenge-Beiträge freigeben" je Jahrgang wie bei Admins; die drei offenen
  Festlegungen der Umsetzung bestätigt ([planung/darf-freigeben.md](planung/darf-freigeben.md#teamerinnen-09102026),
  Branch `feat/teamer-rechte`).
- [x] 09.10.2026 — Die persönliche Abwahl von Zahl und Push (nie im Store
  ausgeliefert) wieder entfernt: Mit Recht kommen rote Zahl, App-Symbol und
  Push, ohne Recht nichts davon (Simon, [planung/darf-freigeben.md](planung/darf-freigeben.md#abgebaut-09102026-nur-das-recht-entscheidet),
  Migration 205, Branch `refactor/kennzahlen-abbau`).
- [x] 09.10.2026 — Referenz-Compose mit dem Live-Stack abgeglichen
  (www-Host, Kompression, Wiederholung, Sticky-Cookie, Router für
  `/docs/api`); Prüfweg für den Abriss auf das Apache-Zugriffslog
  umgestellt, das 28 bis 35 Tage reicht ([api/ABRISS.md](api/ABRISS.md));
  Zählungen „Wer bekommt was" und Bestand gemessen
  (Branch `chore/betrieb-compose-logfenster-zaehlungen`).
- [x] 09.10.2026 — 51 tote Antrags-Mitteilungen (Antrag gelöscht, 33
  ungelesen in der roten Zahl) per Migration 209 nach der Regel des
  Löschens entfernt; die 11.868 Aufrufe von `validate-invite` für einen Code
  sind die am 11.09.2026 behobene Schleife im Browser (10./11.09., keine
  Store-App betroffen, seit 12.09. höchstens 6 je Minute), jetzt mit
  Render-Test an der Seite (Branch `fix/einladung-schleife-altmitteilungen`).
- [x] 09.10.2026 — Konfisprüche: Gemeinde und Wortlaut zusammen? Simon:
  Auswertung nach Gemeinde, Kirchenkreis und Landeskirche, vollständig und
  personenunabhängig; je Wahl Kirchenkreis und Landeskirche vom Zeitpunkt
  der Wahl (Migration 208), Ebene wählbar unter Betrieb › „Sprüche"
  ([messung/umami.md](messung/umami.md), S1; Branch
  `feat/konfspruch-auswertung-ebenen`).
- [x] 09.10.2026 — Reiter, Filter und Leertexte je Seite an einer Stelle für
  App und Web-Fassung (Simon: „Filter ja"): `frontend/src/seiten/`, beschrieben
  in [wissen/gestaltung.md](wissen/gestaltung.md#reiter-filter-und-leertexte-einer-seite);
  dabei gefundene Abweichungen zwischen App und Browser behoben (Branch
  `refactor/seitenbeschreibung-app-web`).
- [x] 09.10.2026 — Ringe und Zähler beachten „Bewegung reduzieren": Punkte-Ringe
  und hochzählende Zahlen sofort auf dem Endstand, dazu der Wisch durch den
  Rückblick und sein Konfetti (Branch `fix/bewegung-randlos-dunkelmodus-ci`).
- [x] 09.10.2026 — Android randlos auf jeder Systemversion, ohne
  `@capacitor/status-bar` und dessen eingestellte Farb-APIs (Play Console
  Punkte 1 und 2, im Repo; Gerätetest offen, siehe [Release](#release);
  Branch `fix/bewegung-randlos-dunkelmodus-ci`).
- [x] 09.10.2026 — Dunkelmodus-Messung in der CI: eigener Job, misst bei
  Änderungen an Stylesheets, Theme oder Messung gegen den E2E-Stack
  ([wissen/dunkelmodus-pruefen.md](wissen/dunkelmodus-pruefen.md), Branch
  `fix/bewegung-randlos-dunkelmodus-ci`).
- [x] 09.10.2026 — Doppelter Code Konfi/Team zusammengelegt: Konfispruch
  setzen und lesen, Spruchliste, Bibelübersetzung, eigenen Antrag stellen
  und löschen, Abzeichen als gesehen markieren; Antworten per
  Charakterisierungstest festgehalten
  (Branch `fix/backend-doppelcode-begruessung-laufzeiten`).
- [x] 10.10.2026 — Live-Stack reicht `APP_MIN_VERSION_IOS`,
  `APP_MIN_VERSION_ANDROID` und `WARTUNG_HINWEIS` an beide Backends weiter
  (Stack-Datei über die Portainer-API ergänzt, Werte leer = aus;
  [betrieb/mindestversion.md](betrieb/mindestversion.md)).
- [x] 09.10.2026 — Laufzeiten im Hintergrund sichtbar (Betrieb BF-10 Rest):
  je Job letzter Start, Dauer und Ergebnis in `/api/metrics`, Dauer des
  Push-Versands, Protokollzeile mit Dauer, Karte „Hintergrund" auf der Seite
  „Betrieb"; Begrüßungsstunde des Teams nach Berliner Zeit
  (Branch `fix/backend-doppelcode-begruessung-laufzeiten`).
- [x] 09.10.2026 — Quelltext-Tests: die 41 mit Verhaltensversprechen
  rendern oder rufen jetzt auf, je mit Gegenprobe (Leitplanke 122 → 82);
  jede Datei in Utils, Hooks und Services hat einen Test (12 → 0), eine
  Leitplanke hält das; dabei behoben: Kategorien und Jahrgänge der
  Terminlisten trugen vertauschte Namen (Branch `test/verhalten-statt-quelltext`).
- [x] 09.10.2026 — Android holt Updates über Googles In-App-Updates:
  sofort unter der Mindestversion, sonst im Hintergrund mit „Neustarten
  zum Aktualisieren" (Branch `feat/android-in-app-update`).


## Offen

### Code

- **Unerklärtes 500 an `mark-read`.** `POST /api/chat/rooms/*/mark-read`
  antwortete zwischen 28.09. und 01.10.2026 einmal mit 500 (bei 718 × 200).
  Am 08.10.2026 keine belastbare Ursache gefunden. Kandidaten: Der Raum wird
  zwischen Rechteprüfung und Schreiben gelöscht (Fremdschlüssel), oder ein
  Deadlock bzw. Verbindungs-Timeout. Beim nächsten Auftreten das Log der
  Replica zur Uhrzeit lesen.

### Tests und CI

- **Komponenten ohne eigenen Test.** 123 von 422 Dateien unter
  `frontend/src/components/` kommen in keiner Testdatei als Pfad vor
  (09.10.2026, 86 davon Web-Fassung; viele laufen in gerenderten
  Seitentests mit). Für `utils/`, `hooks/` und `services/` hält
  `ohneTestLeitplanke.test.ts` die Zahl auf 0, für Komponenten gibt es keine
  Leitplanke (Tests BF-10, Rest).
- **Erste echte Fälle beobachten.** Die Vorwärts-Prüfung des Deploys
  (`NUR_VORWAERTS` in `deploy/rollend.sh`) und die Meldung bei rotem `main`
  (`ci-meldung.yml`) sind nur gegen Nachbauten geprüft. Beim ersten echten
  Überholfall bzw. roten `main` das Log und das Issue ansehen (CI BF-04,
  BF-07, Rest).

### Betrieb

- **Support-Mail seit 08.10.2026 aus.** Der Live-Stack hat in Portainer
  keine Variablen mehr; in beiden Backends sind die Zugänge der Postfächer
  und `MAIL_IMAP_HOST` leer. Seit 08.10.2026 12:09 holt der Server keine
  Mails, Antworten aus der Support-Ansicht scheitern, die Bestätigung eines
  Anliegens entfällt still. Die Abholung endete mit dem ersten Deploy nach
  dem Neustart von Portainer am selben Morgen; `deploy/rollend.sh` schickt die
  Variablen mit, die Portainer meldet — eine leere Liste bleibt leer. Die
  Variablen im Stack wiederherstellen und klären, warum sie fehlen; der Deploy
  prüft heute nicht, ob sie da sind (gemessen 10.10.2026, Auftrag 16).
- **Probe-Anfrage 1 gelöscht.** Anfrage, Vorgang 1 und die Mails 1–6 sind
  nach der Übernahme am 06.10.2026 aus der Datenbank verschwunden (Statistik
  je Tabelle: so viele Löschungen wie Einfügungen); wer gelöscht hat, ist
  nicht mehr feststellbar. War es Simon, ist nichts zu tun — sonst den Weg
  suchen, der Anfragen löscht (gemessen 10.10.2026, Auftrag 16).
- **Aufbewahrung der Sicherungen.** Am Host bleiben 14 tägliche Dumps; die
  Wochen- und Jahresstände aus
  [betrieb/sicherung.md](betrieb/sicherung.md#rhythmus-und-aufbewahrung)
  gibt es dort nicht, und ob das Datei-Backup des Hosts sie abdeckt, ist
  nicht gemessen (01.10.2026).
- **Drossel des Massenversands über der Mailgrenze.** Das Absenderkonto darf
  300 Mails je Stunde; `SMTP_MASSEN_JE_MINUTE` ist im Stack nicht gesetzt,
  also 20 je Minute (1.200 je Stunde). Ein großer nächtlicher Lauf
  (Lizenz-Erinnerung, Löschwarnung) liefe nach rund 15 Minuten in
  vorübergehende Ablehnungen. Im Stack auf höchstens 4 setzen (Messung
  01.10.2026).
- **Uploads wachsen ohne Aufräumen und Wächter.**
  `backend/scripts/cleanupOrphanPhotos.js` und `scripts/verwaiste-dateien.mjs`
  laufen nur von Hand; eine Überwachung des Plattenplatzes gibt es im Repo
  nicht. Heute 237 MB; mit Challenge-Videos (bis 50 MB je Beitrag) wächst
  es bei EKD-Größe schnell (Betrieb, „Nicht geprüft").
- **Lasttest vor der EKD-Ausrollung.** Die Kapazitätsaussage ist aus
  gemessenen Einzelkosten gerechnet. Nicht gemessen: Tausende gleichzeitige
  Sockets (Speicher je Replica bei 512 MB Grenze), Zustellrate und Dauer bei
  Firebase unter Last, Postgres unter Parallellast (Betrieb, „Unklar" und
  „Nicht geprüft").

### Am Gerät

- **Sicherheitsregeln des Browsers (CSP) am Gerät.** In Chrome unter der
  öffentlichen Adresse 0 Meldungen auf 34 Seiten der Leitung (01.10.2026).
  Nicht geprüft: Safari auf dem iPhone, die Ansichten von Konfi und Team,
  QR-Scanner, Sprachaufnahme, Rückblick als Bild (CI BF-14, Rest).
- **Bedienung am Gerät.** Funkloch (Flugmodus; Abmeldung von einem Event ohne
  Netz), VoiceOver und TalkBack je Rolle auf Anmeldeseite und im Chat,
  Systemschrift „Größt", Kaltstart; ein Tipp auf die Statusleiste des
  iPhones scrollt nach oben (sonst kann `@capacitor/status-bar` weg);
  `aps-environment = production` im nächsten IPA (Gesamtabnahme,
  Messung 17; Feature E-09 und Toolchain BF-10, Rest).

### Release

- **Barrierefreiheitsangaben im App Store.** Apple fragt je Gerät ab, welche
  Bedienungshilfen die App unterstützt. Heute angebbar: Dunkelmodus, „Nicht
  nur über Farbe" und „Bewegung reduzieren" (Ringe und Zähler seit
  09.10.2026, [Handbuch](handbuch/03-bedienung.md#bewegung-reduzieren)). Kontrast im Hellmodus nicht: 25 von 51
  Text-Tokens mit festem Farbwert im Hellmodus
  (`frontend/src/theme/variables.css`) bleiben auf Weiß unter 4,5:1
  (gemessen 08.10.2026; siehe [Zurückgestellt](#zurückgestellt), „Kontrast
  im Hellmodus"). VoiceOver, Sprachsteuerung und größere Schrift erst nach
  dem Test am iPhone ([Am Gerät](#am-gerät), „Bedienung am Gerät").
- **Play Console empfiehlt vier Änderungen an der Android-App** (Release
  2.3.0, abgelesen von Simon am 07.10.2026). Am Code geprüft:
  1. *Randlose Anzeige ab Android 15:* Die App zielt auf SDK 36; Google rät,
     die randlose Anzeige zu testen bzw. `EdgeToEdge.enable()` zu rufen.
     **Im Repo erledigt (09.10.2026, Branch
     `fix/bewegung-randlos-dunkelmodus-ci`):** `MainActivity` ruft
     `EdgeToEdge.enable` nach `super.onCreate`, randlos auf jeder
     Android-Version; die Insets trägt das eingebaute SystemBars-Plugin als
     CSS-Variablen. Offen: Gerätetest Malte (Leisten oben/unten, Dunkel- und
     Hellmodus, Tastatur, Datumsauswahl).
  2. *Eingestellte APIs* `Window.get/setStatusBarColor`, `setNavigationBarColor`
     — aufgerufen aus `@capacitor/status-bar` (v8) und dem Material-Datepicker,
     nicht aus eigenem Code. **Im Repo erledigt (09.10.2026, selber Branch):**
     `@capacitor/status-bar` ist auf Android nicht mehr eingebunden
     (`android.includePlugins` in `capacitor.config.ts`; iOS behält es). Auch
     8.0.4 ruft die APIs bei jedem Start, ein Update half nicht. Übrig im
     Bytecode, zur Laufzeit ab Android 11 nicht gerufen: `androidx.activity`
     (EdgeToEdge, nur Android 6–10) und Materials `EdgeToEdgeUtils` (nur in
     dessen eigenen Dialogen, die die App nicht öffnet; 1.9 bis 1.13 gleich).
     Die Console kann beide weiter nennen. Offen: Gerätetest Malte, danach der
     Haken in der Console.
  3. *Feste Ausrichtung:* `android:screenOrientation="portrait"` in
     `android/app/src/main/AndroidManifest.xml`; ab Android 16 ignoriert das
     System sie auf Tablets und Foldables. **Bewusst offen** (Simon,
     08.10.2026): Die Apps bleiben im Hochformat; eine Tablet-Fassung kommt,
     wenn überhaupt, über die Web-Version.
  4. *R8 schwach:* Optimierungsrate 48 %, Verschleierung 49 %, Ressourcen 49 %
     bei Bundle 134 (2.3.0), gebaut noch mit dem Android-Gradle-Plugin 8.13.1.
     Laut Console: 6,35 MB neu, 2,31 MB Update, Ziel-SDK 36, ab API 24,
     16-KB-Seitengröße unterstützt, DEX-Optimierung „Medium“, unkomprimierter
     DEX 4,13 MB. Erfüllt (grüner Haken): „Vollständiger Modus“ und
     „Entfernung von Ressourcen“. Nicht erfüllt: „Optimierte Entfernung von
     Ressourcen“ und „Klassen neu bündeln“ — beide gibt es erst mit AGP 9.
     **Im Repo erledigt (08.10.2026, #231):** AGP 9.2.1, Gradle 9.5.1; am
     unsignierten Release-Bau gemessen DEX 4,13 → 4,03 MB, Ressourcen 1,39 →
     1,02 MB, Klassen neu gebündelt (in Paketen 2.305 → 92). Offen: Maltes
     Gerätetest (versionCode 135) und der Haken in der Console nach dem
     Release, Auftrag [18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md).
  Keins davon bricht die App heute; 2 und 3 werden mit Android 16 sichtbar.

## Bei Simon zu entscheiden

- **Beschriftungen, Reiter und Filter an einer Stelle für App und
  Web-Fassung?** Laden, Rechte und Zähler teilen sich beide Fassungen; die
  Darstellung ist doppelt. Die Web-Fassung hat 130 Dateien mit rund 18.700
  Zeilen TSX und 6.700 Zeilen CSS neben rund 78.100 Zeilen
  App-Komponenten; an 54 Stellen wählt eine Weiche zwischen beiden
  (gezählt 06.10.2026). Ein neuer Filter oder ein umbenannter Reiter muss
  heute an zwei Stellen nachgezogen werden. Vorschlag: je Seite eine
  gemeinsame Beschreibung von Texten, Reitern und Filtern, aus der App und
  Web-Fassung lesen. Umsetzen?
- **Konfisprüche: Gemeinde und Wortlaut zusammen?** Die Statistik
  `konfspruch_wahlen` (Migration 207, ohne Personenbezug) speichert je Wahl
  die Gemeinde und den Monat, bei eigenen Sprüchen den Wortlaut. In einer
  kleinen Gemeinde ist ein eigener Spruch mit Gemeinde und Monat einer
  bestimmten Konfi zuzuordnen — der Spruch steht auf der Urkunde und oft im
  Gemeindebrief; das gilt auch nach dem Löschen des Kontos. Die Ansicht
  unter Betrieb zeigt die Gemeinde nicht. Gemeinde weiter speichern,
  weglassen oder vergröbern (etwa Landeskirche)?
  ([messung/umami.md](messung/umami.md), S1)

## Geplant

- **Version 2.4.0** — Challenges als Seiten, Web-Version mit
  Support-Ansicht, Rollenfarben, Mehrfach-Konten (gebaut) und
  kleinere Punkte: [planung/2.4.0.md](planung/2.4.0.md).
- **Web-Version: was noch fehlt** — Leiste links, Support-Ansicht mit
  Vorgängen, Posteingang, Formularen und Support-Mail sowie die
  Browser-Ansichten aller Bereiche sind gebaut (03. bis 07.10.2026).
  Offen: die Gruppe „Verwaltung" in der Leiste, der Rückweg
  „ohne Gemeinde" nach einem Gemeindewechsel, weitere Kennzahlen,
  „Einwilligung liegt vor" am Konfi-Profil
  ([planung/web-version.md](planung/web-version.md), Abschnitt „Offen");
  Zuweisung von Vorgängen an einzelne Support-Konten und Bildschirmfotos im
  Support-Formular ([planung/support-vorgaenge.md](planung/support-vorgaenge.md));
  die Spalte „Letzte Aktivität" der Konfi-Tabelle im Browser bleibt
  ausgeblendet, bis `GET /admin/konfis` das Feld `letzte_aktivitaet`
  (additiv) liefert.
- **Feature-Empfehlungen** mit Simons Antworten vom 02.10.2026 —
  vor der EKD-Ausrollung Einwilligung (E-01, Vermerk am Konfi-Profil),
  Löschfristen (E-02), Selbstauskunft (E-21) und Hilfe und Support (E-04,
  E-18, E-20, in der Support-Ansicht); danach Vorlagenkatalog, Jahrgangsabschluss,
  Nachtruhe, Feature-Schalter ohne Chat, Statusseite, Ehrenamtsnachweis,
  Mehrjahresvergleich, Objektspeicher:
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md).

## Zurückgestellt

- **Sprühangriff über viele Konten.** Die Kontosperre zählt je Konto (10
  Fehlversuche je Stunde); wer viele Konten mit je wenigen Versuchen
  durchprobiert, wird nur von der IP-Grenze gebremst (300 je 15 Minuten).
  Am 08.10.2026 geprüft, nichts geändert, weil beide Wege einen Preis haben:
  Eine engere IP-Grenze trifft Schulklassen, die hinter einer Adresse
  sitzen; eine globale Grenze für Fehlversuche wäre ein Hebel, alle
  auszusperren. Seit 27.09.2026 (Sicherheit BF-04, Rest). Simon,
  08.10.2026: „wir warten mal ab, wer soll das tun" — so lassen, bis ein
  Anlass (gehäufte Fehlversuche über viele Konten im Log) es nahelegt.
- **Rechenschaft vor der EKD-Ausrollung.** Die Datenschutzerklärung sagt
  nichts zur Mitarbeit in mehreren Gemeinden (wer sieht was, wer stimmt zu);
  ein Verzeichnis der Verarbeitungstätigkeiten, TOM und AVV — oder ein
  Verweis, wo sie liegen — fehlen (Doku BF-08, Rest). Eine Datenauskunft nach
  DSG-EKD (Art. 15 DSGVO) gibt es nicht als Route; ob der Rückblick als
  Auskunft genügt, ist offen. Geplant als E-21 „Selbstauskunft"
  (Sicherheit, „Unklar: Auskunftsroute"). Simon, 08.10.2026: „machen wir
  später" — vor der Ausrollung wieder aufnehmen.
- **Tablets und Querformat.** Die Apps sind auf beiden Plattformen auf
  Hochformat gesperrt (Simon, 19.09.2026: „Will ich nicht auf phones"; UI
  BF-06). Simon, 08.10.2026: Die Apps bleiben so; eine Tablet-Fassung käme
  über die Web-Version. Das Handbuch nennt die Sperre nicht.
- **Upload aus Nextcloud auf Android.** PDF und Word gehen vom Android-Handy
  aus dem Download-Ordner und aus Google Drive (Build 133, Gerätetest
  02.10.2026), nicht aber über die Nextcloud-App. Vermutung, nicht gemessen:
  Die Nextcloud-App liefert einen Verweis auf ihren eigenen Anbieter und lädt
  erst beim Lesen; liegt die Datei nicht auf dem Gerät, scheitert schon die
  Auswahl. Die Fehlermessung zeigt das als `fehler` mit `ort`
  `dateiauswahl-…` (`frontend/src/services/uploadDiagnose.ts`). Ausweg für
  Nutzer:innen: die Datei in Nextcloud erst herunterladen. Simon, 02.10.2026:
  „nextcloud links auf android irgendwann vielleicht". Wieder aufnehmen, wenn
  sich weitere Gemeinden melden — dann zuerst diese Fehlermessung auswerten.
- **Kontrast im Hellmodus.** Bereichsfarben als Schrift erreichen im Hellen
  teils nur 2,15:1 (Badges), dazu weiße Symbole auf den Eck-Marken und die
  Kopfbanner der Event-Details. Simon, 29.09.2026: „Der Kontrast ist uns
  erstmal egal." Alle Textstellen hängen an den Tokens `--app-text-<bereich>`;
  ein hellerer Wert lässt sich je Bereich an einer Stelle setzen (UI BF-04,
  Rest). Gemessen 08.10.2026: 25 von 51 Text-Tokens mit festem Farbwert
  liegen auf Weiß unter 4,5:1 — deshalb keine Kontrast-Angabe bei Apple.
- **react-router 6.** Zwei moderate Meldungen (Open Redirect über Backslash,
  Constructor Injection bei SSR-Hydration) treffen die App nicht: kein SSR,
  Navigationsziele nur aus festen Pfaden mit eingesetzten Kennungen; Push-,
  App-Link- und Umleitungsziele laufen über `buildPushTargetUrl`,
  `deepLinkZiel` und `umleitungsZiel`. Ein Update ist nicht möglich,
  `@ionic/react-router` verlangt `react-router <7`. Auf GitHub am 01.10.2026
  als „tolerable risk" geschlossen. Wieder prüfen, sobald Ionic react-router 7
  zulässt oder ein Navigationsziel aus Nutzereingaben, API-Antworten oder
  Push-Daten gebaut wird.
- **Präfix-redundante Indizes.** 33 Einzelspalten-Indizes neben einem
  längeren hatten am 01.10.2026 keinen einzigen Zugriff — bei 169 Konten liest
  der Planer kleine Tabellen aber ohnehin ganz. Bei deutlich größerem Bestand
  `pg_stat_user_indexes.idx_scan` neu messen, dann entscheiden (Datenbank
  BF-09, Rest).
- **Fremdschlüssel `integer` statt `bigint`.** 55 Fremdschlüssel bleiben: Die
  Umstellung schriebe große Tabellen unter Sperre neu, ohne dass eine App
  oder Abfrage es merkt; neue Migrationen nehmen `BIGINT` (Wächter
  `migrationenKonventionen.test.js`). Wieder aufnehmen, falls ein Wert 2³¹
  nahekommt (Datenbank BF-12, Rest).
