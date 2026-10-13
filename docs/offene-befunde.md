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

- [ ] **Maltes Gerätetest Android versionCode 140** (interner Testtrack seit
  11.10.2026) — Rückmeldung je Prüfpunkt aus
  [Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md), Schritt 4,
  dazu Systemleisten oben und unten (hell, dunkel, Gesten und drei Knöpfe,
  Tastatur, Datumsauswahl) und das In-App-Update
  ([betrieb/mindestversion.md](betrieb/mindestversion.md)).
- [ ] **VoiceOver, Sprachsteuerung und größte Schrift am iPhone** —
  Voraussetzung für die Barrierefreiheitsangaben bei Apple
  ([Release](#release), „Barrierefreiheitsangaben im App Store").

### Als Nächstes

- [ ] **Release 2.4.0** — ausliefern ([Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md),
  Schritt 5), danach die Haken in der Play Console prüfen ([Release](#release),
  „Play Console empfiehlt vier Änderungen"); Ablauf in
  [betrieb/release.md](betrieb/release.md). Sobald 2.4.0 in beiden Stores
  live ist: `APP_MIN_VERSION_IOS` und `APP_MIN_VERSION_ANDROID` als
  Stack-Variablen auf `2.4.0` (Simon, 10.10.2026;
  [betrieb/mindestversion.md](betrieb/mindestversion.md)). Vorher das
  Play-Bildschirmfoto `konfi-challenge-feed` nach dem Deploy der deckenden
  Kopfleiste neu ziehen.
- [ ] **Web-Version: was noch fehlt** — Support-Ansicht auf Handy und im
  Web übersichtlicher (Simon, 10.10.2026; Mails, Posteingang, Vorgänge und
  ihre Detailseiten erledigt 11.10.2026, Struktur, Textbausteine und Konten
  offen), eigene Fenster für die übrigen Formulare (Simon, 11.10.2026;
  die häufigen erledigt 11.10.2026, offen etwa Challenge, Konfi,
  Teilnehmende und Zertifikat zuweisen), Leiste „Verwaltung", Rückweg ohne
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
  personenunabhängig (Branch `feat/konfspruch-auswertung-ebenen`). Am
  10.10.2026 zurückgebaut, siehe unten.
- [x] 10.10.2026 — Auswertung der Konfisprüche aus App und Betrieb entfernt
  (Simon: „Raus aus der App. Nur Umami!"): Reiter „Sprüche", Route
  `GET /api/metrics/konfisprueche` und Tabelle `konfspruch_wahlen`
  (Migration 212) entfallen; die Wahl geht ab 2.4.0 als
  `konfispruch-erste-wahl` bzw. `konfispruch-gewechselt` mit Spruch,
  Gemeinde, Kirchenkreis und Landeskirche an Umami ([messung/umami.md](messung/umami.md), S1). Dazu den
  Schema-Dump bis 208 gefaltet, samt den Datenzeilen aus 190 und 193
  (Branch `revert/konfisprueche-nur-umami`).
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
- [x] 10.10.2026 — Bildschirmfotos der Challenges erneuert: Detail und Feed
  (iPhone und Play) zeigen die eigene Seite statt des Dialogs (Branch
  `docs/screenshots-challenges-2.4.0`).
- [x] 10.10.2026 — Konfis ohne Jahrgang stehen beim Sortieren nach
  Jahrgang in der Web-Fassung in beiden Richtungen unten, wie im Team und in
  jeder Tabelle (Branch `fix/sortierung-ohne-jahrgang`).
- [x] 10.10.2026 — Android: Kopfleiste auch im hellen Modus deckend, der
  Inhalt scheint beim Rollen nicht mehr durch (Branch
  `fix/android-kopfleiste-deckend`; Play-Bildschirmfoto `konfi-challenge-feed`
  nach dem Deploy neu ziehen).
- [x] 10.10.2026 — Support-Mail wieder an: Sie war seit 08.10.2026 12:10
  aus, weil der Live-Stack keine Variablen mehr hatte; Variablen
  wiederhergestellt, beide Postfächer holen wieder ab (Auftrag 16, Branch
  `docs/auftrag-16-probelauf`).
- [x] 10.10.2026 — Support-Probelauf mit Vorgängen (Auftrag 16): Anfrage,
  Formular, Posteingang und Mail eines Leitungskontos ordnen richtig zu,
  höchstens 2,1 Minuten bis zur Zuordnung; Probe-Vorgänge 2–5 erledigt und
  im Archiv. Konto 404 und das Probe-Postfach bleiben bewusst stehen
  ([betrieb/support-ansicht.md](betrieb/support-ansicht.md#was-vom-probelauf-stehen-bleibt);
  Branch `docs/auftrag-16-probelauf`).
- [x] 10.10.2026 — Deploy prüft die Pflicht-Stack-Variablen der Support-Mail
  und bricht vor dem Stack-Update ab, wenn eine fehlt oder leer ist; Status,
  Kennzahlen und Seite „Betrieb" melden, wenn die Support-Mail aus ist oder
  länger als 30 Minuten nicht abgeholt wurde (Anlass: 46 Stunden ohne
  Support-Mail nach verlorenen Stack-Variablen am 08.10.2026; Branch
  `fix/deploy-stackvariablen-pruefen`).
- [x] 10.10.2026 — Datenbank vor der EKD-Ausrollung aufgeräumt (BF-09 und
  BF-12, Rest): 24 Einzelspalten-Indizes, die ein längerer Index mitträgt,
  entfernt; alle Fremdschlüssel und die sieben Schlüssel, auf die sie
  zeigen, sind bigint; Wächter für beides im Test-Schema
  (Branch `refactor/db-indizes-fremdschluessel`).
- [x] 10.10.2026 — Web Konfis/Team: Kennzahl-Kacheln mit Symbol und
  Bereichsfarbe, Badges und Zertifikate in der Liste farbig wie in den
  Kacheln, Funktionsbeschreibung der Teamer:in im Kopf der Detailansicht
  (Web und App) (Branch `feat/web-konfis-kacheln-icons`).
- [x] 10.10.2026 — Rangliste des Jahrgangs mit Mischkonten: Konfi ist, wer
  es in der Gemeinde des Jahrgangs ist (beide Quellen); der eigene Rang hängt
  an der Person statt an der Punktzahl (Anlass: „1/1" bei einem Konto, das
  zuhause Leitung und in der Testgemeinde Konfi ist; Branch
  `fix/rangliste-mischkonto`).
- [x] 10.10.2026 — Web: gemeinsame Bausteine für Listen-Seiten (WebListenSeite
  mit Kennzahlen, Werkzeugzeile aus der Seitenbeschreibung, Liste/Kacheln;
  WebListe als die eine sortierbare Tabelle, WebKacheln, WebKreis);
  Aktivitäten-Katalog und Konfis/Team darauf umgestellt
  (Branch `refactor/web-bausteine`).
- [x] 11.10.2026 — Kompakte Fenster im Browser (Simon: „Web braucht eigene
  kompaktere Modale überall"): alle App-Modale ab 992 px kompakt
  (`theme/web-modale.css`, Merkmal `data-layout` aus
  `navigation/layoutImDokument.ts`); eigene Fenster (`WebDialog`) für Event,
  Aktivität eintragen, Bonuspunkte, Aktivität melden und prüfen, Material,
  Badge, Kategorie, Level, Zertifikat, Benutzer:in, Jahrgang, Passwort und
  E-Mail, die Logik je Formular in einem Hook, den App-Modal und Fenster
  teilen. Dabei behoben: Badge-Auswahl beim Bearbeiten und Zeitraum ohne
  eigene Wahl, deutsches Datum beim Melden in der App, „Aktivität
  eintragen" ohne Netz mit gemerkter Liste, Enter im Suchfeld, Level ohne
  Farbwahl im Browser, Team-Liste nach „Teamer:in anlegen" im Browser.
- [x] 11.10.2026 — Support-Detailseiten übersichtlich, nach Simons Antworten
  vom selben Tag: Stand-Satz mit Hauptknopf, Notiz oben, Verlauf flach mit
  dem Editor unter der jüngsten Mail und „Danach“, Angaben als Karten,
  Ablehnen, Einordnen mit Speichern auch in der App, Vorgang „Lizenz und
  Abrechnung“ mit „Lizenz ändern“, Menü je Mail (verschieben, herauslösen),
  Mail im Posteingang mit Einsortieren als Hauptknopf und Weiterleitung in
  den Vorgang, „Breit lesen“ und nächster Eintrag im Browser; dabei die
  sechs Darstellungsfehler vom Messen behoben, dazu die drei vom Ansehen
  (12.10.2026): der Titel „Mail“ in der iOS-Kopfzeile der Mail-Seite,
  „Support“ im Verlauf der App ganz (das Konto kürzt zuerst) und „‹ Alle …“
  mit ‹ › auch, solange der nächste Eintrag lädt oder fehlt
  ([planung/support-detailseiten.md](planung/support-detailseiten.md);
  Branches `support-detail/*`).
- [x] 12.10.2026 — Rückfragen und Meldungen aus einem Browser-Fenster stehen
  über ihm: `WebDialog` hängt in `ion-app` statt an `<body>`, in derselben
  Ebene wie Ionics Alerts und Toasts (gemessen: 0 von 384 Rasterpunkten
  über fünf Fenstern bei 1440 und 1024 px gehören der Seite, Toast und
  „Nicht möglich“ obenauf). „Gemeinde anlegen“ fragt im Browser in einem
  zweiten Fenster, wie Event und Badge. Damit auch die beiden Toasts, die
  noch unter einem Fenster lagen: „Fehler beim Öffnen der Datei“ im Material
  und „Foto erfolgreich gelöscht“ beim Prüfen einer Aktivität.
- [x] 13.10.2026 — Support-Detailseiten Paket 6 (Simon, 12.10.2026: „Genau
  so wie du sagst“), ohne den kompakten Rahmen (Frage 10): Listen von
  Vorgängen und Posteingang am Handy (erste Karte iOS y 504 → 239, Android
  431 → 202; erste Mail bei zwei gestörten Postfächern 616 → 289 bzw.
  623 → 252), „Absender gehört zu …“ mit „In Vorgang N einsortieren“ und
  vorbelegtem Einsortieren (Frage 11), „Danach“ in einem Aufruf mit der
  Antwort, Antwort-Kopfzeilen auf die beantwortete Mail, die Antwort aus
  dem Posteingang an die angezeigte Person, und die neuesten Mails der
  Übersicht führen direkt in ihren Vorgang. Alle Felder additiv
  ([planung/support-detailseiten.md](planung/support-detailseiten.md);
  Branch `claude/fervent-edison-wp5yfj`).


## Offen

### Code

- **Unerklärtes 500 an `mark-read`.** `POST /api/chat/rooms/*/mark-read`
  antwortete zwischen 28.09. und 01.10.2026 einmal mit 500 (bei 718 × 200).
  Am 08.10.2026 keine belastbare Ursache gefunden. Kandidaten: Der Raum wird
  zwischen Rechteprüfung und Schreiben gelöscht (Fremdschlüssel), oder ein
  Deadlock bzw. Verbindungs-Timeout. Beim nächsten Auftreten das Log der
  Replica zur Uhrzeit lesen.
- **Abstimmen per Nachrichten-ID kann die falsche Umfrage treffen.**
  `POST /api/chat/polls/:pollId/vote` sucht erst eine Umfrage mit dieser
  ID und erst dann eine zur Nachricht mit dieser ID; alle Apps schicken die
  Nachrichten-ID. Gleicht die Nachrichten-ID zufällig der ID einer anderen
  Umfrage, landet die Stimme dort — bei einer einmaligen Antwort wäre sie
  dann auch noch fest. Ungefährlich, solange es weit weniger Umfragen als
  Nachrichten gibt; sauber wäre, dass neue Apps `poll_id` schicken bzw. die
  Route `/messages/:id/vote` nur per Nachricht sucht (10.10.2026).
- **Aufdecken nach Ablauf kommt nicht live.** Bei „Namen erst später
  aufdecken" mit Ablaufdatum sind die Namen nach dem Ende aufgedeckt, das
  rechnet das Backend beim Lesen aus. Ein `pollUpdated` geht dabei nicht
  hinaus; wer den Chat offen hat, sieht die Namen erst beim nächsten Laden
  (10.10.2026).
- **Neues Level ohne Farbwahl scheitert in der App.** `LevelManagementModal`
  schickt ohne eigene Farbwahl `color: 'var(--app-color-level)'`;
  `levels.color` ist `varchar(7)`, `POST /api/levels` antwortet mit 500
  „Fehler beim Erstellen des Levels". Das Farbfeld zeigt dabei Schwarz. So
  seit 05.09.2026, also auch in der Store-Version 2.3.0; im Browser ab 992 px
  behoben (das Fenster belegt die Farbe mit `levelFarbeAlsHex` vor). Der
  Store-App hilft nur das Backend: eine Farbe, die nicht `#rrggbb` ist, durch
  die Vorgabe ersetzen statt abzubrechen (additiv); für die App dieselbe
  Vorbelegung, mit einem Test, der zuerst fällt (11.10.2026).
- **„Heute" ist beim Melden und Eintragen das UTC-Datum.** Aktivität melden,
  Aktivität eintragen und Bonuspunkte belegen das Datum mit
  `new Date().toISOString().split('T')[0]` vor (`useAktivitaetMelden`,
  `useAktivitaetEintragen`, `useBonusVergeben`), das Melden setzt damit auch
  den spätesten Tag. Zwischen Mitternacht und 2 Uhr (Winterzeit 1 Uhr) steht
  dort der Vortag, und beim Melden lässt sich der heutige Tag nicht wählen.
  App und Browser gleich; richtig wäre das lokale Datum (11.10.2026).
- **„Aktivität eintragen" ohne Netz braucht eine einmal geladene Liste.**
  Die Liste der Aktivitäten kommt ohne Netz aus dem Speicher
  (`admin:activities:<Gemeinde>:<Rolle>`, derselbe Schlüssel wie die Seite
  Aktivitäten). Hat das Gerät sie nie geladen, geht ohne Netz nur
  Bonuspunkte vergeben; das Fenster im Browser sagt das, das App-Modal zeigt
  eine leere Liste mit gesperrtem Haken. Möglich: die Liste beim Anmelden der
  Leitung vorladen (11.10.2026).
- **Aktivitäten eines neuen Badges folgen nicht der Zielgruppe.**
  `useBadgeFormular` lädt `/admin/activities?target_role=` nach dem Reiter
  der Seite, nicht nach der im Formular gewählten Zielgruppe. Wer aus der
  Konfi-Liste ein Badge anlegt und auf Team umschaltet, bekommt bei
  „Spezifische Aktivität" und „Aktivitäts-Kombination" Konfi-Aktivitäten
  angeboten; die Wertung zählt für Team-Badges nur Team-Aktivitäten, das
  Badge wird nie vergeben. App und Browser gleich; beim Wechsel der
  Zielgruppe neu laden (11.10.2026).
- **„Badge neu prüfen" nennt die Zahl der Geprüften nicht.**
  `POST /admin/badges/:id/pruefen` liefert `geprueft` und `neu_vergeben`;
  App und Browser zeigen nur die neu Vergebenen bzw. „Alle Badges sind
  aktuell". Das Handbuch sagte bis 11.10.2026, auch die Zahl der Geprüften
  stehe da, und beschreibt jetzt den Ist-Stand. Offen, ob die Meldung sie
  nennen soll (11.10.2026).
- **Event-Serie in der App ohne Griff an den Regler scheitert.** „Als Serie
  erstellen" lässt `series_count` auf 1 (`EventFormSections`), der Regler
  steht am Anschlag bei 2, die Zahl daneben zeigt 1; `POST /events/series`
  antwortet 400 „Name, Datum und Serienanzahl (min. 2) sind erforderlich".
  Das Fenster im Browser setzt beim Einschalten mindestens 2 (`mitSerie` in
  `eventFormularRegeln.ts`); die App bräuchte denselben Aufruf (11.10.2026).
- **Kopie eines Events: Anmeldeschluss und Zeitfenster wandern nicht mit.**
  `nachDatumswechsel` behandelt eine Kopie als Bearbeiten (`!!event`, die
  Vorlage hat id 0). Die Kopie beginnt im Vorschlag binnen einer halben
  Stunde, ihr Anmeldeschluss liegt kurz davor; wer das Datum verschiebt,
  behält diesen Schluss, und die Anmeldung schließt kurz nach dem Anlegen.
  Zeitfenster bleiben am alten Tag. Dazu heißt das App-Modal bei einer
  Kopie „Event bearbeiten". App und Browser teilen die Regel; das Fenster im
  Browser nennt nur den abweichenden Tag am Zeitfenster (11.10.2026).
- **Platzzahl in der Event-Liste kommt als Text.** `GET /events` liefert
  `max_participants` aus einem `CASE` mit `SUM(...)`, also als `bigint` und
  damit als Text (`'0'`, `'50'`). Eine Kopie aus der Liste zeigt ein
  unbegrenztes Event im App-Formular als begrenzt (`=== 0`). Die Antwortform
  bleibt (ausgelieferte Apps); umwandeln gehört in die App (`Number()` beim
  Füllen des Formulars) (11.10.2026).
- **Kompakte Fenster im Browser: Feinschliff aus der Bilderprüfung**
  (11.10.2026, alle Fenster bei 1440 und 1280, hell und dunkel angesehen;
  kein Feld abgeschnitten, keine Überlappung):
  - Die Datumsfelder der eigenen Fenster folgen der Sprache des Browsers;
    ein englisch eingestellter Browser zeigt „10/11/2026, 05:00 PM". Mit
    deutschem Browser steht dort „11.10.2026, 17:00". Das App-Modal zeigte
    im Browser immer Deutsch.
  - Die beiden Datumswähler in `ChallengeManageModal` haben kein
    `locale="de-DE"` (die übrigen Datumswähler der App setzen es); auf einem
    englisch eingestellten Gerät oder Browser kommen englische Monate und
    12-Stunden-Zeit.
  - Das Schließen-Kreuz der Fenster ist klein (Symbol 14 px im
    30-px-Knopf), das App-Modal hatte ein großes Kreuz links.
  - Scrollen im Scrollen: das Symbolraster beim Badge (eigene Höhe 248 px)
    und die Eventliste beim Material scrollen in einem Fenster, das selbst
    scrollt; beim Material sind nach dem Scrollen Titel und Kreuz weg.
  - „Aktivität melden": „Aktivität" ohne Pflichtstern, der Platzhalter
    „Anmerkungen... (optional)" doppelt zum Hinweis „Freiwillig." und mit
    drei Punkten statt „…" (ebenso „Bitte gib einen Grund für die Ablehnung
    an..." beim Prüfen); unter zwei Team-Aktivitäten bleiben links etwa
    170 px leer.
  - „Benutzer:in anlegen": Passwortfeld ohne Platzhalter und ohne Hinweis
    auf die Regeln (vorher „Passwort eingeben").
  - „Neues Level": „Benötigte Punkte" ist mit 0 vorbelegt; gibt es schon
    ein Level mit 0 Punkten, lehnt der Server ohne Änderung ab („Ein Level
    mit dieser Punktzahl existiert bereits"). Nur im Code nachvollzogen.
  - Im Dunkeln hebt sich der Datumswähler über einem App-Modal kaum ab
    (gleicher Grund wie die Karte darunter), und der Knopf der Schalter ist
    schwarz statt weiß.
  - Die Anwesenheit nutzt die 880 px schlecht: Namensspalte schmal und
    zentriert, die Σ-Spalte nimmt die rechte Hälfte ein.

### Tests und CI

- **Cron-Leader-Anzeige sieht Locks anderer Datenbanken.**
  `cronLeaderVorhanden` (`backend/utils/cronLeader.js`) sucht den
  Advisory-Lock in `pg_locks` ohne Bedingung auf die Spalte `database`.
  Advisory-Locks gelten je Datenbank, `pg_locks` zeigt aber die des ganzen
  Clusters: Läuft ein zweiter Konfi-Quest-Server gegen eine andere
  Datenbank desselben Clusters, meldet `/api/status` `cron_leader: true`,
  auch wenn in der eigenen niemand den Lock hält. Gesehen am 13.10.2026
  lokal: Mit einem laufenden Server auf der Datenbank `live` scheitern die
  Tests in `cronLeader.test.js` und `statusBetrieb.test.js`, die
  `konfi_test` im selben Cluster nutzen. Ob in Produktion eine zweite
  Datenbank im Cluster läuft, ist nicht geprüft. Vorschlag:
  `AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`
  mit Test (13.10.2026).
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

- **Support am Handy: Filter-Knopf zählt die Suche mit.** In der App steht
  die Suche hinter dem Knopf „Filter“ und zählt deshalb mit („Filter, 1
  aktiv“, sobald etwas gesucht wird); im Browser steht sie daneben und zählt
  nicht. So lassen, weil sonst eine Suche hinter dem zugeklappten Knopf
  unbemerkt eingrenzt, oder wie im Browser nur Art und Gemeinde zählen?
  (13.10.2026)
- **Support: Antwort aus dem Posteingang nur auf Mails im Posteingang.** Die
  Antwort von der Seite einer Mail im Posteingang geht an die jüngste
  eingehende Mail des Gesprächs, die selbst noch im Posteingang liegt. Liegt
  eine jüngere Mail desselben Gesprächs schon in einem Vorgang, wird sie
  übergangen — sonst bekäme die Antwort die Zuordnung dieses Vorgangs und
  stünde nicht mehr im Posteingang. So lassen, oder in dem Fall auf den
  Vorgang verweisen („Die jüngste Mail liegt in Vorgang N“)?
  (`posteingangsAntwortAuf` in `frontend/src/utils/supportMail.ts`;
  13.10.2026)
- **Support-Detailseiten: Kreis der Art im schmalen Lesebereich.** Unter
  600 px Lesebreite — bei 1280 px Fensterbreite neben der Liste — blendet
  der Kopf den Kreis der Art aus; mit Kreis rutschten die Knöpfe in eine
  zweite Reihe (Kopf 123 bzw. 135 statt 95 px, die Anfrage 135 statt 113 px,
  gemessen 11.10.2026). Die Art steht dann in den Kennzeichen; bei einer
  Anfrage steht dort „Noch nicht angelegt“, „Neue Gemeinde“ fehlt schmal
  also. Der Plan sieht den Kreis ohne Ausnahme vor. So lassen oder den
  Kreis kleiner zurückholen?
  ([planung/support-detailseiten.md](planung/support-detailseiten.md#messbarer-gewinn))
  (11.10.2026)
- **Support-Detailseiten: Messziele, die verfehlt sind.** Gemessen am
  12.10.2026 gegen dieselben Testdaten wie der Plan: Der Kopf der Anfrage ist
  im Browser 131 px hoch (Ziel ≈ 104, vorher 134), beim breiten Lesen mit der
  Leiste zum Blättern 133 px; mit dem Betreff in bis zu drei Zeilen sind
  Mail-Vorgang (1440) und Anliegen (1280) 117 statt 95 px hoch. Beim
  Antworten rollt der Lesebereich 390 / 622 / 494 px (1440) bzw. 588 / 760 /
  670 px (1280; Anliegen, Anfrage, Mail-Vorgang) statt höchstens 300, und
  bei 1280 bleiben von der beantworteten Mail unter dem Kopf 6 / 30 / 6 px
  im Bild (geschätzt waren 150). „Test Org-Admin 1“ steht im Anliegen an 7
  Stellen statt 4, die Kontaktperson der Anfrage am Handy an 5 statt 3 (die
  Skizze zeigt selbst 6). Die Seite am Handy ist 1817 / 2113 / 1943 px lang
  (Ziel ≈ 1600 / 1700 / 1300, vorher 2647 / 4001 / 2227), weil die jüngste
  Mail ganz offen steht und die Angaben offen folgen. Ziele neu setzen oder
  nachbessern — etwa die jüngste Mail am Handy nach einigen Zeilen kürzen,
  die Angaben dort einklappen, den Editor bei 1280 niedriger beginnen, den
  Namen an Stand oder Antwortzeile weglassen?
  ([planung/support-detailseiten.md](planung/support-detailseiten.md#messbarer-gewinn))
  (12.10.2026)
- **„Lizenz ändern“ bei einer gesperrten Gemeinde.** Nach Ablauf von
  Testphase oder Lizenz sperrt der nächtliche Lauf die Gemeinde
  (`is_active = false`, `backend/services/backgroundService.js`). „Lizenz
  ändern“ im Vorgang verlängert die Laufzeit, schreibt `is_active` aber
  unverändert zurück: Der typische Antrag „Testphase abgelaufen, bitte
  Lizenz“ endet mit einer weiter gesperrten Gemeinde. Seit 12.10.2026 sagen
  Vorschau und Erfolgsmeldung das („Der Zugang der Gemeinde bleibt gesperrt
  – freigeben lässt er sich im Formular der Gemeinde.“). Soll der Dialog bei
  einer gesperrten Gemeinde selbst „Zugang wieder freigeben“ anbieten (der
  PUT darf `is_active` setzen; keine neue Route)?
  ([betrieb/support-ansicht.md](betrieb/support-ansicht.md#die-lizenz-im-vorgang-ändern))
  (12.10.2026)
- **Event mit fremdem Jahrgang speichern.** Eine Leitung, die nur einem Teil
  der Jahrgänge eines Events zugewiesen ist, kann es weder in der App noch im
  Browser speichern: `PUT /events/:id` prüft jeden Ziel-Jahrgang
  (`zielJahrgangErlaubt`) und antwortet 403 „Kein Zugriff auf diesen
  Jahrgang". Den fremden Jahrgang kann sie nicht abwählen, weil sie ihn nicht
  sieht; das Fenster im Browser nennt ihn unter der Auswahl. Gewollt (dann
  bearbeitet nur die Gemeindeleitung solche Events, und das Handbuch sagt
  es), oder soll das Backend unverändert gelassene fremde Jahrgänge zulassen?
  (11.10.2026)
- **Meldungen der Browser-Fenster in der Fehlermessung.** Prüf- und
  Serverfehler stehen in den eigenen Fenstern im Fenster selbst und laufen
  nicht über `setError` im `AppContext`, also nicht in die anonyme
  Fehlermessung (`trackFehler`); die App misst sie weiter, die
  Support-Fenster schon bisher nicht. Mitzählen hieße: ein Weg im
  `AppContext`, der misst, ohne einen Toast zu zeigen (11.10.2026).

## Geplant

- **Version 2.4.0** — Challenges als Seiten, Web-Version mit
  Support-Ansicht, Rollenfarben, Mehrfach-Konten (gebaut) und
  kleinere Punkte: [planung/2.4.0.md](planung/2.4.0.md).
- **Web-Version: was noch fehlt** — Leiste links, Support-Ansicht mit
  Vorgängen, Posteingang, Formularen und Support-Mail sowie die
  Browser-Ansichten aller Bereiche sind gebaut (03. bis 07.10.2026), die
  kompakten Fenster mit eigenen Fenstern für die häufigen Formulare
  (11.10.2026). Offen ([planung/web-version.md](planung/web-version.md#offen)):
  Support-Ansicht auf Handy und im Web übersichtlicher (Struktur,
  Textbausteine, Konten), eigene Fenster für die übrigen Formulare, die
  Gruppe „Verwaltung" in der Leiste, der Rückweg „ohne Gemeinde" nach einem
  Gemeindewechsel, weitere Kennzahlen, „Einwilligung liegt vor" am
  Konfi-Profil; Zuweisung von Vorgängen an einzelne Support-Konten und
  Bildschirmfotos im Support-Formular
  ([planung/support-vorgaenge.md](planung/support-vorgaenge.md)); die Spalte
  „Letzte Aktivität" der Konfi-Tabelle im Browser bleibt ausgeblendet, bis
  `GET /admin/konfis` das Feld `letzte_aktivitaet` (additiv) liefert.
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
  Dazu gehören die Links und Aktionen der Support-Detailseiten in der App
  (`--app-text-users`, 3,66:1; gemessen 11.10.2026) sowie im Mail-Verlauf
  der Kreis „KQ“ (1,95:1) und die Marke „Gesendet“ (1,98:1).
- **react-router 6.** Zwei moderate Meldungen (Open Redirect über Backslash,
  Constructor Injection bei SSR-Hydration) treffen die App nicht: kein SSR,
  Navigationsziele nur aus festen Pfaden mit eingesetzten Kennungen; Push-,
  App-Link- und Umleitungsziele laufen über `buildPushTargetUrl`,
  `deepLinkZiel` und `umleitungsZiel`. Ein Update ist nicht möglich,
  `@ionic/react-router` verlangt `react-router <7`. Auf GitHub am 01.10.2026
  als „tolerable risk" geschlossen. Wieder prüfen, sobald Ionic react-router 7
  zulässt oder ein Navigationsziel aus Nutzereingaben, API-Antworten oder
  Push-Daten gebaut wird.
