# Baustellen

Stand: 24.08.2026, abends. Eine Liste, damit nichts doppelt läuft und nichts
untergeht. **Erledigtes wird nicht gelöscht, sondern abgehakt** — sonst weiß
später niemand mehr, ob etwas gemacht wurde oder nur vergessen.

Live: `7561d33` · Version 2.0.0 (unveröffentlicht) · iOS-Build 140 im TestFlight

## Wie hier gearbeitet wird

Simons Vorgabe vom 24.08.2026: **"Keine offenen Enden."** Viele Prüfaufträge
liefen schon einmal, aber es wurde nie festgehalten, ob das Ergebnis auch
umgesetzt wurde. Deshalb gilt für jeden Punkt:

1. **Befund prüfen, nicht glauben.** Ein Agentenbericht ist eine Behauptung.
   Offensichtliche Fehler ohne Biss werden ein zweites Mal geprüft, bevor
   jemand sie repariert.
2. **Fixen.**
3. **Mit Tests härten** — verbotener und erlaubter Fall, konkrete Werte.
   Gegenprobe: Der Test muss rot werden, wenn man den Fix zurücknimmt.
4. **Den Fix auditen lassen**, wo er nicht trivial ist.
5. **Hier abhaken**, mit Commit-Hash. Ein Punkt gilt erst als erledigt, wenn
   er ausgerollt und nachgemessen ist — nicht, wenn ein Agent "fertig" meldet.

Ein Punkt verschwindet nie aus dieser Datei. Er wandert nach oben zu den
Erledigten.

---

## Erledigt und ausgerollt (24.08.)

- [x] **Umzug auf server.godsapp.de** — Datenbank (57 Tabellen deckungsgleich
      geprüft), Uploads, DNS, TLS. Der Fahrtenbuch-Server reicht Aufrufe
      übergangsweise durch und gleicht nachts ab (`/opt/konfi-quest/NOTFALL.md`).
- [x] **Staging entfernt** — Stack, Verzeichnis, Domain, Build-Workflow.
- [x] **Multi-Org-Push** — jeder Push trägt die Organisation des Inhalts, beim
      Antippen wechselt die App dorthin. *Nicht in Build 140 — erst im nächsten.*
- [x] **Push-Meldungen konsolidiert** — keine Texte mehr in den Routen.
- [x] **Handbuch verlinkt** — Navigation, Fließtext, Mobil-Symbol; aus dem
      Handbuch führt ein Verweis zur API-Referenz.
- [x] **Navigation der Startseite** — Logo klebte am ersten Menüpunkt, Knöpfe
      brachen zweizeilig um. Behoben, "Warum" ist aus der Leiste geflogen.
- [x] **Titel im Bereich Mitmachen** wechselt mit dem Reiter.
- [x] **Jahrgang beim Konfi-Anlegen** als Liste statt Aufklappmenü.

## Erledigt, noch nicht ausgerollt (committet, nicht gepusht)

- [x] **Onboarding und "Was ist neu"** auf den Mitmachen-Tab umgestellt, alle
      drei Rollen, Events und Aktivitäten mit Erklärung (`20f4da23`).
- [x] **Challenges: Entwürfe unter "Geplant"**, Bearbeiten-Knopf im geöffneten
      Modal, Entwurf ohne Datum (`f3d06c29`).
- [x] **Challenge-Links nur von Musikdiensten** (Spotify, Apple Music, YouTube
      Music, Deezer) mit Titel und Interpret (`4bf2b7d7`).

---

## Offen: Challenges (Simons Sammlung vom 24.08. abends)

### Abzeichen und Sichtbarkeit
- [x] **Abzeichen erst nach Freigabe.** Umgesetzt (`3443df5b`): has_badge und
      marks zählen nur noch approved-Beiträge (alle Ableitungsstellen:
      GET /konfi, GET /konfi/:id, GET /admin), der Abzeichen-Push feuert erst
      bei der Freigabe. **Entschieden (24.08.): gleiche Regel für alle** —
      so umgesetzt, als Absicht dokumentiert im Kopfkommentar von
      `routes/challenges.js`.
- [x] **Sauberer Feed für die Leitung** — Reiter Feed/Wartet/Ausgeblendet im
      Leitungs-Detail; der Feed zeigt nur Freigegebenes (`3443df5b`).
- [x] **Nachträglich anonymisieren** — gab es nur bei "Konfi entscheidet";
      jetzt bei jeder Sichtbarkeit und für Team-Beiträge, weiter unumkehrbar,
      'private'-Zusagen bleiben geschützt (`3443df5b`).
- [x] **Begründung bei Ablehnung** — optionales Feld beim Ausblenden
      (Migration 126, `moderation_note`), sichtbar am eigenen Beitrag, dazu
      Push an die einreichende Person (`3443df5b`).
- [x] **Leitung braucht kein Ausblenden** für eigene Beiträge — Aktion bei
      eigenen Beiträgen entfernt, "Wieder einblenden" bleibt (`3443df5b`).

### Beschriftungen und Anzeige
- [x] **"Konfi entscheidet"** → "Selbst entscheiden" (Anlage, Liste, Handbuch).
      *Rest: `ChallengeLeitungModal.tsx:219` "Konfi entscheidet je Beitrag" —
      Datei gehört dem Parallel-Agenten.*
- [x] **"Nur für euch in der Leitung"** → "Nur Leitung". *Rest: ebenfalls nur
      noch `ChallengeLeitungModal.tsx:218`.*
- [x] **"5 offen"** → nur Zahl und Uhr-Symbol, title/aria sagen es in Worten.
- [x] **"1 Beiträge"** — Einzahl/Mehrzahl über `utils/challengeTexte.ts`
      (mit Tests); weitere Challenge-Zähler geprüft.
- [x] **Grüner Ton bei freigegebenen Beiträgen** — neu
      `--app-color-success-strong` (#059669) in variables.css; Konfi-Detail
      und Legende umgestellt. *Rest: `ChallengeLeitungModal.tsx` Zeilen
      174/181/495 nutzen noch `--app-color-success` (hell).*
- [ ] **Statistik-Kopf** — NICHT umgesetzt: liegt in `ChallengeLeitungModal.tsx`
      (gesperrt wegen Parallel-Arbeit). Vorschlag: "Sichtbar" statt "Frei"
      (kurz, Paar zu "Versteckt"), Reihenfolge Sichtbar/Wartet/Versteckt,
      Beitragszahl mit korrekter Einzahl (`anzahlBeitraege`) in den Kopf.
- [x] **Hinweis über dem Beitragsfeld** → als Untertitel in die
      Banner-Überschrift des Einreich-Modals (Muster Detail-Modal).
- [x] **Unter "Worum geht es"** stehen jetzt Sichtbarkeit und
      sofort/Freigabe in der Meta-Zeile; der Hinweis-Kasten entfiel.

### Hinweise raus aus dem Modal, rein in die Doku
- [x] Hinweis bei **Abzeichen** im Erstellen-Modal ersatzlos gestrichen
- [x] Hinweis bei **Zeitraum** gestrichen (auch die Boxen "Entwurf braucht
      keinen Zeitraum" / "startet automatisch" / "Start nicht verschiebbar")
- [x] Hinweis bei **Sichtbarkeit** gestrichen (Sperr-Hinweis nach Start)
- [x] Inhalte im Handbuch (`80-challenges.md`): Entwurf ohne Zeitraum,
      Startsperre/Endeverlängerung, Benachrichtigung beim Start; Sperr-Logik
      stand dort schon. Abzeichen-Abschnitt zusätzlich an die neue
      Freigabe-Regel (3443df5b) angepasst.

### Zurückgestellt (Simons Entscheidung)
- [ ] **"Abzeichen" widerspricht "es gibt nichts dafür"** — vielleicht besser
      "mitgemacht". Bewusst später.

---

## Offen: sofort fixen (24.08.)

- [x] **Teamer-Dashboard kennt keine Challenges** — Teaser-Karte wie im
      Konfi-Dashboard ergänzt, Schalter in den Dashboard-Einstellungen.
      Nebenbefund: der Konfi-Challenges-Schalter war wirkungslos, greift jetzt.
- [x] **Teamer sollen ihren Konfispruch eintragen können** — Karte im
      Teamer-Dashboard, beförderte bringen ihn aus konfi_profiles mit,
      andere tragen ihn über das Auswahl-Modal ein (GET /teamer/konfsprueche,
      PATCH /teamer/profile, Upsert). Schalter für beide Dashboards.
- [x] **Umfrage im Chat, Einstellungen** — Schalter wie beim
      Challenge-Erstellen, Erklärungen brechen mehrzeilig um; globale Klassen
      app-toggle-item__title/__hint in variables.css.
- [x] **Neuigkeiten-Karte auf dem Dashboard** (`48dc2286`) — der grüne
      Mitmachen-Hinweis (entfernt in `589802b8`) kommt als Karte "Was ist neu
      in Version 2.0?" im Look des Profil-Banners zurück: alle drei Rollen,
      Antippen öffnet den Walkthrough, X blendet dauerhaft aus. Der
      Walkthrough poppt nicht mehr von selbst auf; "Was ist neu?" im Profil
      gab es schon in allen drei Bäumen (geprüft). Bewusst OHNE
      Leitungs-Schalter: einmaliger Hinweis, räumt sich selbst auf.
      Browser-geprüft mit demo.leitung/demo.teamer/demo.emilia. Noch nicht
      ausgerollt.

---

## Offen: Handbuch (24.08. abends)

- [x] **Mobile Navigation** — erledigt durch `debc8af3` (24.08.), nachgeprueft
      am 25.08.: einklappbar (`<details>` plus Mini-Skript) und mitlaufend
      (`position:sticky; top:0; z-index:30`), der aufgeklappte Inhalt scrollt
      in sich statt die Seite zu verlaengern. Alle 13 Doku-Seiten tragen die
      neue Navigation. *Die 53 px habe ich im Code belegt, nicht im Browser
      nachgemessen.*
      ALT: Gemessen bei 390 px: Die Seitenleiste ist 449 px hoch, also
      53 Prozent des Bildschirms, der Inhalt beginnt erst darunter.
- [ ] **Querverweise zwischen den Kapiteln** wie in einem Wiki — heute steht
      jedes Kapitel für sich. *(In Arbeit.)*
- [ ] **Konfis einladen per QR-Code und Code** fehlt als richtige Beschreibung
      (heute nur eine Zeile in `30-leitung.md:130` und ein kurzer Abschnitt in
      `35-passwoerter.md`). *(In Arbeit.)*
- [ ] **Check-in per QR-Code bei Terminen** ebenfalls nur als Warnung erwähnt
      (`70-termine.md:146`), nicht erklärt. *(In Arbeit.)*
- [ ] Hinweise aus dem Challenge-Erstellen-Modal (Abzeichen, Zeitraum,
      Sichtbarkeit) sollen ins Handbuch. *(In Arbeit, anderer Agent.)*

---

## Offen: größere Prüfaufträge (jeweils ein Agent)

- [x] **Schnelle App** — gemessen statt geschätzt. `/organizations/current`
      198,7 ms -> 0,95 ms (Kreuzprodukt mit 77.376 Zwischenzeilen aufgeloest,
      `bde959a3`); drei doppelte Abfragen entfernt (`53e45f27`). Keine
      Index-Migration: groesste Tabelle 8.440 Zeilen, waere Spekulation.
      Offen als eigenes Vorhaben: das 3-MB-Bundle aufteilen (siehe unten).
      ALT: Ladezeiten überall messen,
      nicht schätzen. Unnötige Abfragen finden, besonders beim Start und beim
      Wechsel zwischen Bereichen. Hängt mit dem Dashboard-Punkt unten zusammen
      (abgeschaltete Bereiche sollen gar nicht erst abfragen).
      *Zwischenstand 24.08. abends, committet, NICHT ausgerollt:* Produktion
      vermessen (alle Endpunkte je Rolle, lokal am Server): fast alles 3–13 ms,
      zwei Ausnahmen. (1) `/organizations/current` 189 ms durch Join-Kreuz-
      produkt (77.376 Zwischenzeilen) — gefixt auf 0,9 ms (`bde959a3`).
      (2) Doppelte Client-Requests: `GET /chat/rooms` lief beim Öffnen des
      Chat-Tabs in allen drei Rollen doppelt, `mark-seen` beim Badges-Tab
      doppelt — gefixt und nachgemessen (`53e45f27`). Stündliche Abzeichen-
      Prüfung nachgemessen: ~23 ms/Person Basisqueries, 86 Personen ≈ 2–3 s/h,
      unkritisch; 5-Minuten-Zähler bestätigt 2 Abfragen (4,3 ms). Indizes: alle
      Tabellen < 8.500 Zeilen, kein messbarer Gewinn möglich — keine Migration.
      NOCH OFFEN (nur berichtet): JS-Monolith 3.005 kB (697 kB gzip) ohne
      Route-Splitting; `/konfi/badges` beim Konfi-Start doppelt (MainTabs-
      Zähler + Dashboard, Dashboard-Dateien waren tabu); N+1 in
      `jahrgaenge.js:407` (Sprüche je Konfi einzeln). Erledigt erst nach
      Deploy + Nachmessung in Produktion.
- [x] **Verschwindende Nachrichten** — vier echte Verlustwege gefunden und
      geschlossen (`5932c9a2`), 26 Tests mit Gegenprobe. Eine Grenze bleibt:
      Absturz exakt waehrend des ersten Sendeversuchs.
      ALT: wurde schon einmal umgebaut (Fehler in
      der Warteschlange und der Wiederhol-Logik), aber nie abschließend
      bestätigt. Nochmal ansehen: Kann eine Nachricht noch verloren gehen?
      *Geprüft 24.08.: Ja, konnte sie — vier Wege gefunden und geschlossen
      (`5932c9a2`): unsichtbare/aufgegebene Queue-Nachrichten nach Neustart,
      fehlgeschlagener Online-Versand nur im React-State, kein Flush beim
      Kaltstart plus Retry-Budget-Verbrauch offline, kommentarloses Leeren
      bei Org-Wechsel und Logout. 26 neue Tests, Gegenprobe je Fix rot.
      Noch nicht ausgerollt — erst nach Deploy und Nachmessen abhaken.*
- [x] **Jahrgangswechsel und Pflichttermine** — erledigt durch `9d3eeeb3`
      (der Commit-Titel nennt nur den Chat, der Code behandelt die Termine
      mit). Nachgeprueft am 25.08.: `konfi-management.js:311-351` raeumt
      kuenftige Pflichttermine des alten Jahrgangs ab — nur ohne erfasste
      Anwesenheit und nur, wenn der Termin nicht auch zum neuen Jahrgang
      gehoert —, `:352-375` bucht die des neuen nach, samt Event-Chats.
      Fuenf Tests mit harten Assertions inklusive beider Grenzfaelle.
- [x] **Event-Chats** — am 24.08. behoben (Eintritt bei Anmeldung, Austritt
      bei Abmeldung in allen drei Wegen).
      ALT: Eintritt bei Anmeldung, Austritt bei Abmeldung, aber
      bei Pflichtterminen drin bleiben. *(Teilweise am 24.08. behoben —
      prüfen, was noch offen ist.)*
- [ ] **Abzeichen: sind alle Bedingungen korrekt?** Was liegt überflüssig in
      der Datenbank? *(Geprüft am 25.08.: alle 15 Bedingungstypen werten das,
      was ihr Hilfetext verspricht — keine Lücke in der Logik. Die Befunde
      liegen in den DATEN und wurden in Produktion belegt:*
      - *Namenskopplung wirkt tatsächlich: Abzeichen 36 sucht die Kategorie
        `Senior:innen`, die heute `Seniorinnen` heißt; 35 sucht `Jugend`, das
        es nicht mehr gibt; 197 liegt im Altformat. Alle aktiv, nie vergeben.*
      - *4 aktive Abzeichen ohne jede Bedingung (40, 41, 43, 50) — Altbestand,
        neu anlegbar seit `9d3eeeb3` nicht mehr.*
      - *3 `mandatory_event_count`-Abzeichen mit Schwellen, die die Daten nicht
        hergeben (Org 4: Schwelle 5 bei 3 Pflichtterminen).*
      - *Verwaiste Zeilen: keine (drei Gegenproben, alle null).*
      *Datensätze am 25.08. in Produktion geradegezogen (eine Transaktion,
      Org 1): Abzeichen 36 auf "Seniorinnen" umgestellt; Kategorie "Jugend"
      (Typ both, id 36) angelegt und Abzeichen 35 bleibt aktiv; 40/41/43/50
      deaktiviert. Gegengeprüft: niemand erfüllt Abzeichen 36 bereits, es
      wurde also nichts rückwirkend vergeben.*
      **Noch offen:** Kategorie "Jugend" hat 0 Aktivitäten und 0 Termine —
      Abzeichen 35 bleibt unerreichbar, bis in der App Aktivitäten zugeordnet
      sind. Der Umbau von Namen auf IDs gehört nach 2.0.0.)*
- [x] **API-Doku** — 98 Pfade zeigten auf falsche Adressen (fehlendes
      `/api`-Praefix), behoben und gegen die echte API geprueft. Alle 238
      Routen dokumentiert, keine tote, 243 Berechtigungen maschinell gegen
      die Middleware geprueft: null Fehler (`b5d76109`).
      ALT:
- [x] **Swagger** — Standard-Look war bereits da (nur die Explorer-Leiste
      ist versteckt, das ist ueblich). Gruppierung neu: 21 Themen statt drei
      Sammelbloecken mit 173 von 243 Routen, keine ueber 24. Material ist
      Material (`b5d76109`).
      ALT:, aber kleinschrittiger dokumentieren.
      Wo sind Fehler, Doppelungen, Unnötiges?
- [ ] **Handbuch mit Bildschirmfotos** — exakte Beschreibung aller Abläufe.
- [x] **Abzeichen-Pruefung nachgemessen** — 2 bis 3,5 Sekunden pro Stunde
      fuer 86 Personen. Der frueher vermutete Engpass besteht nicht.
- [x] **Pushes nach dem Abmelden** — erledigt durch `f267a982` (23.08.),
      nachgeprueft am 25.08.: `routes/auth.js:1207ff` loescht den Push-Token
      des Geraets beim Logout, der Client ruft zusaetzlich
      `DELETE /notifications/device-token`. Drei Tests in `auth.test.js`
      (eigener Token weg, fremde Geraete und fremde Konten bleiben).
      *Titel war falsch einsortiert: Push laeuft ueber Firebase/APNs, nicht
      ueber Socket.IO.*
      **Restluecke:** Beim SITZUNGSABLAUF (nicht beim bewussten Abmelden)
      bleibt der Push-Token stehen — ein serverseitiges Loeschen waere dort
      mangels gueltigem Token auch nicht mehr authentifizierbar.
- [x] **Live-Aktualisierung: fehlende Empfänger** — behoben (`23ee763a`),
      Empfänger nachgerüstet in Konfi-Detail (Leitung), Termin-Detail (beide
      Bäume) und im Teamer-Baum (Dashboard, Abzeichen, Profil, Statistik);
      vier hart auf `'konfi'` verdrahtete Sendestellen in `events.js` auf die
      echte Rolle umgestellt. Der als unsicher gemeldete Befund zu
      `events.js:1791` hat sich beim Nachprüfen NICHT bestätigt (eigener
      Teamer-Zweig sendet dort korrekt) und wurde nicht angefasst.
      *Ausgerollt am 25.08. (Image `bc9d42b`) und in Produktion nachgemessen:
      Demo-Konfi mit offenem Dashboard, Punktvergabe per API von aussen —
      14 -> 15 ohne Neuladen, nach der Ruecknahme wieder 14. Beide Richtungen
      kommen live an. Testpunkt entfernt, Datenstand unveraendert (8+6).*
      ALT: (geprüft 25.08.). Das Senden
      im Backend ist gut ausgebaut (rund 130 Sendepunkte, saubere Raum-
      Auflösung). Die Lücken sitzen bei den EMPFÄNGERN — von 17 Admin-Seiten
      hören 11, von 8 Teamer-Seiten nur 3, von 6 Konfi-Seiten 5:
      - *Konfi-Detail der Leitung hört auf gar nichts — ausgerechnet die
        Ansicht, in der Punkte vergeben werden.*
      - *Termin-Detail hört in BEIDEN Bäumen nicht. 32 gesendete Ereignisse
        kommen nicht an, QR-Check-in inklusive: Der Server sendet bei jedem
        Scan, der Zähler auf dem offenen QR-Code steht still.*
      - *Teamer-Baum systematisch unterversorgt: Dashboard, Abzeichen und
        Konfi-Statistik gehen leer aus. Beim Abzeichen sendet das Backend
        sogar gezielt richtig, nur der Empfänger fehlt.*
      - *Anwesenheit: `'konfi'` ist hart verdrahtet (`events.js:2786/2788`),
        teilnehmende Teamer:innen sitzen im falschen Raum.*
      *Sauber sind Anträge, Challenges, Chat, Rollen-Raum-Auflösung und
      Mehrfach-Organisationen. Webhooks: keine vorhanden.*
      *Noch als UNSICHER markiert und vor einem Fix nachzusehen: ob
      `events.js:1791` und `:2137` in der Praxis auch Teamer treffen können.*
- [x] **Dashboard-Schalter** — zwei waren wirkungslos (`dashboard_show_challenges`
      kam im Backend nie vor, der Konfispruch-Schalter wurde ignoriert). Beide
      wirken jetzt, und bei "aus" wird die Route gar nicht erst abgefragt
      (`03a20a09`, `3439e9ed`).
      ALT: Wirkung der Schalter in der
      Leitungsansicht und die Sortierreihenfolge. Ist ein Bereich aus, sollen
      seine Routen gar nicht erst abgefragt werden.

---

## Bekannte Fehler, Ursache belegt, Fix offen

- [ ] **Testläufe brechen sporadisch ab** (etwa jeder vierte). Ursache belegt
      und am 25.08. präzisiert: `backend/database.js` feuert beim MODUL-LADEN
      einen unbeaufsichtigten Selbsttest ab, der im Fehlerfall `process.exit(1)`
      ruft — das killt den ganzen vitest-Worker. `utils/liveUpdate.js` lädt das
      Singleton NICHT beim Import, sondern lazy in den Funktionen (Zeilen 49,
      111, 164, 233); es entsteht also mitten im Testlauf. Daher die Sporadik.
      *Teilfix am 25.08. (`8fc097ce`): `process.exit(1)` greift nur noch
      außerhalb von Tests (`NODE_ENV !== 'test'`). Nachgemessen: fünf Läufe
      hintereinander grün, je 1167 Tests. Bei einer Rate von "jeder vierte"
      wäre das zu rund 24 % auch Zufall — gutes Indiz, kein Beweis. Bleibt
      offen, bis die CI weitere Läufe geliefert hat.*
      *`liveUpdate` bekommt den Pool jetzt übergeben (`init(io, db)`) statt ihn
      zu holen — die vier lazy `require('../database')` sind weg.*
      **Die zweite Spur ist belegt und NICHT behoben:** Im Gesamtlauf fällt
      reproduzierbar 1 von 1171 Tests mit `Parse Error: Expected HTTP/, RTSP/
      or ICE/` aus, wechselnd welcher. Gegenprobe am 25.08.: drei Läufe OHNE
      die Änderungen des Tages zeigen denselben Fehler — er ist vorbestehend.
      Ursache: Mehrere Termin-Routen senden `res.json()` und führen DANACH
      weitere `await`-Operationen und nicht abgewartete Live-Updates aus
      (z.B. `events.js:2682ff`). Schließt supertest die Verbindung, während
      der Server noch schreibt, bricht der HTTP-Parser ab. Isoliert laufen
      dieselben Dateien grün durch.
      *Frühere Meldung "fünf saubere Läufe" war insoweit zu optimistisch: sie
      liefen, bevor die neue Testdatei dazukam.*
      Dritter Fund am 25.08., gleiches Muster wie `database.js`:
      `routes/events.js` rief beim Modul-Laden `process.exit(1)`, wenn
      `QR_SECRET` fehlte — behoben, greift nur noch außerhalb von Tests.
- [ ] **`notifications.test.js` macht echte FCM-Netzwerkaufrufe** aus der
      Testsuite, mit der echten Firebase-Datei. Langsam und fragwürdig.

## Notiert, nicht angefasst

- [ ] `sitemap.xml` kennt das Handbuch nicht; `lastmod` überall 04.08.
- [ ] FAQ dupliziert die Preisliste — zwei Pflegestellen.
- [ ] "Das geht 2026 wirklich besser" auf der Startseite altert zum Jahreswechsel.
- [ ] "kein Tracking" steht dreimal auf der Startseite, während Umami lädt
      (cookiefrei, self-gehostet, gemeint ist die App — trotzdem angreifbar).

---

## Sicherheitsmeldungen von GitHub (24.08. geprüft)

- Dependabot: **0 offene Meldungen**.
- CodeQL: **6 offene**, alle "high" — jede wird einzeln geprüft, nicht blind
  gefixt. Fehlalarme werden begründet geschlossen, nicht stillgelegt.
  *(In Arbeit.)*
  - [ ] 101 `js/missing-rate-limiting` — `docsAuth.js:82`. Die Doku-Anmeldung
        hat kein Rate-Limit; ein einzelnes Passwort ohne Benutzernamen ist
        damit durchprobierbar. **Berechtigt, der ernstere der beiden.**
  - [ ] 100 `js/insufficient-password-hash` — `docsAuth.js:106`. SHA-256 dient
        dort nur dem zeitkonstanten Vergleich, nicht dem Speichern; CodeQLs
        Lesart greift daneben. Ohne Rate-Limit ist die geringe Rechenzeit
        aber real relevant.
  - [ ] 99 `js/missing-rate-limiting` — `challenges.js:809`
  - [ ] 98 `js/xss-through-dom` — `AudioPlayer.tsx:131`
  - [ ] 97 `js/xss-through-dom` — `ChallengeSubmitModal.tsx:690`
  - [ ] 96 `js/xss-through-dom` — `ChallengeSubmitModal.tsx:625`

---

## Nach 2.0.0

- [ ] **Das 3-MB-Bundle aufteilen** (697 kB gepackt, ein Monolith ohne
      Aufteilung nach Rollen). Groesster Hebel fuer den Kaltstart im Web,
      geschaetzt 697 -> etwa 400-450 kB je Rolle. BEWUSST NICHT vor 2.0.0:
      Der Umbau fasst die Wurzel des Routings an, trifft also jede Nutzerin,
      und nachladbare Teile brechen typischerweise erst im echten Betrieb bei
      schlechtem Netz. Der Nutzen ist einmalig (danach Cache, nativ ohnehin
      im Paket), die Fehler waeren dauerhaft.

---

## Erledigt am 25.08. (committet, NICHT ausgerollt)

Produktion lief bei Redaktionsschluss auf `6721eec`. Alles Folgende ist
committet und muss noch deployt werden — erst danach abhaken.

- [x] **Live-Aktualisierung** — Dedupe-Regression behoben (`8fc097ce`),
      fehlende Empfänger in allen drei Bäumen nachgerüstet, vier hart auf
      `'konfi'` verdrahtete Sendestellen auf die echte Rolle (`23ee763a`).
      In Produktion nachgemessen: 14 auf 15 ohne Neuladen.
- [x] **Regler** — Skalenenden grau, Wert farbig, Abzeichen-Maximum wächst mit
      (`4d7f520b`). Acht Stellen.
- [x] **Abzeichen** — stilles Deaktivieren beim Teil-Update behoben
      (`6ef4c625`); sechs kaputte Datensätze in Produktion geradegezogen.
- [x] **Challenges** — Kopf-Infos benannt ("Sichtbarkeit:", "Moderiert:"),
      "Ausgeblendet" nur wo sinnvoll, Einzahl/Mehrzahl, Info-Kasten raus
      (`5c7c4ab7`).
- [x] **Musik-Links** — Titel/Interpret/Album getrennt dargestellt, Album neu
      (Migration 127), YouTube-Kanalname korrigiert (`6721eecf`).
- [x] **Pflichttermine** — Zähler zeigte Anwesende statt Angemeldete
      (`0db13f09`); Teamer wurden zweimal abgezogen (`a0bea11e`).
- [x] **Mitmachen-Hinweis** zurück auf Startseite und dauerhaft unter "Mehr"
      (`9aee14d1`), mit eigenem Erklärtext.
- [x] **Teamer-Ansicht** — "Alle" zeigt Team-Termine, Nur-Team ohne Konfi-Werte
      (`b814e401`).
- [x] **Teamer-Zusage** — "Ich bin dabei" / "Ich bin nicht dabei" (`ed5a6e2a`),
      ohne Begründungszwang. Die Leitung sieht Absagen in der Teamer-Liste.
- [x] **Offline** — Termin-Detail nutzt den Listen-Cache (`c8348375`, war der
      Hauptärger: "alles 0 und rot"); Aktivitätenliste und Tageslosung gecacht,
      über 30 stille Abbrüche melden sich jetzt (`c2b40ad6`).
- [x] **Zähl-Fehler** — Anmeldung konnte still schließen, Detail zählte Teamer
      mit, `opted_out` galt als "ausstehend" (`bdc04fad`).
- [x] **Eine Quelle für alle Buchungszahlen** — View `event_booking_stats`
      (Migration 128, `9cb4aa24`). Fünf Stellen zählten mit drei Bedeutungen;
      das war die Wurzel der drei Fehler des Tages.
- [x] **Getrennte Sammelverbuchung** Konfis/Teamer (`eaac09e5`). Abgemeldete
      und bereits Verbuchte bleiben unangetastet (getestet, Gegenprobe).
- [x] **Verbuchen-Kennzeichen bleibt bei offenen Teamern** (`90592c5b`).
      Korrigiert einen eigenen Fehler: Beim Beheben von Befund 3 war
      `unprocessed_count` konfi-rein gemacht worden — dadurch verschwand ein
      Termin aus dem Verbuchen-Reiter, sobald alle Konfis verbucht waren.
      Jetzt: verbucht wird nach Rolle, gezählt wird gemeinsam.

## Zielgerade 2.0.0 (Reihenfolge)

1. Laufende Agenten abwarten, Ergebnisse prüfen (nicht glauben), ausrollen
2. GitHub-Meldungen abschließen — CodeQL und Dependabot sauber
3. Restliche Prüfaufträge starten (Abzeichen-Logik, API-Vollständigkeit,
   Swagger, Socket.IO nach Logout, Dashboard-Schalter)
4. **Deploy**
5. **TestFlight-Build** — dann mit Multi-Org-Push, den Build 140 noch nicht hat
6. Erst danach: Store-Texte, Bildschirmfotos, Tag, Release

## Vor dem Release 2.0.0

- [ ] Bildschirmfotos aus Organisation 4 (als Skript, damit sie nicht veralten)
- [ ] Store-Texte — 157 Changelog-Einträge sind für Nutzer:innen zu viel
- [ ] Version setzen, Git-Tag, GitHub-Release (Tag ohne `v`-Präfix)
- [ ] Neuer Build mit dem Multi-Org-Push (Build 140 hat ihn noch nicht)
