# Baustellen

Stand: 24.08.2026, abends. Eine Liste, damit nichts doppelt läuft und nichts
untergeht. **Erledigtes wird nicht gelöscht, sondern abgehakt** — sonst weiß
später niemand mehr, ob etwas gemacht wurde oder nur vergessen.

Live: Image `d3d6976` · Version 2.0.0 (unveröffentlicht) · iOS-Build 146 im
TestFlight

> **26.08.2026: Abuse-Sperre und Rückumzug.** Der Hauptserver war wegen einer
> Nachzügler-Beschwerde zum bereits abgeschlossenen Vorfall vom 19./20.08.
> gesperrt; Konfi Quest lief rund zwei Stunden auf der Rückfallebene und ist
> nach der Entsperrung zurückgezogen. **Kein Datenverlust:** Auf dem
> Hauptserver lagen zwei Datensätze mehr (eine Chat-Nachricht, eine
> Challenge-Einreichung von heute früh), im Notbetrieb war nichts Neues
> entstanden — der Hauptserver war also der vollständigere Stand, ein
> Rückspielen entfiel. Alle acht verglichenen Tabellen geprüft.
> Das Demo-Passwort ist auf **beiden** Servern rotiert.
> Ablauf und Zugänge stehen in der Notfall-Anleitung auf der Rückfallebene,
> bewusst nicht hier — dieses Repo ist öffentlich.

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

## Falle: Die Reiter-Zähler hängen an ZWEI verschiedenen Mechanismen

Gefunden am 27.08.2026 beim Bauen von H1 — wäre um ein Haar ein neuer Fehler
geworden.

In `MainTabs.tsx` gibt es fünf Zahlen an den Reitern. Sie sehen gleich aus,
werden aber völlig unterschiedlich aktualisiert:

| Zähler | Quelle | Aktualisiert durch |
|---|---|---|
| `chatUnreadTotal` | `useBadge()` | `refreshAllCounts()` |
| `pendingRequestsCount` | `useBadge()` | `refreshAllCounts()` |
| `pendingEventsCount` | `useBadge()` | `refreshAllCounts()` |
| `pendingChallengesCount` | `useBadge()` | `refreshAllCounts()` |
| **`newBadgesCount`** | **eigener State** | **`useLiveRefresh('badges')`** |

Die ersten vier kommen gesammelt aus `GET /notifications/badge-counts`
(`BadgeContext.tsx:80`). Der Abzeichen-Zähler steht dort **nicht** drin — er
lädt eigenständig (`MainTabs.tsx:184`) und hört auf
`useLiveRefresh('badges')` (`MainTabs.tsx:204`).

**Die Falle:** Wer nach einer Aktion einen Zähler aktualisieren will, greift
intuitiv zu `refreshAllCounts()`. Für den Abzeichen-Zähler bewirkt das
**nichts** — die rote Zahl bleibt stehen, obwohl der Server sie längst auf 0
gesetzt hat. Kein Fehler, keine Warnung, es passiert einfach nichts.

**Richtig ist:**
- Abzeichen-Zähler zurücksetzen → `triggerRefresh('badges')` aus
  `useLiveUpdate()`
- alle anderen vier → `refreshAllCounts()` aus `useBadge()`

Aufgefallen ist es nur beim Nachlesen der Verdrahtung, nicht durch einen
fehlschlagenden Test — genau deshalb steht es hier. Ein Test in
`abzeichenZaehlerTeamer.test.ts` sichert die richtige Wahl inzwischen ab.

**Der eigentliche Hebel** wäre, den Abzeichen-Zähler in
`GET /notifications/badge-counts` mit aufzunehmen und aus dem `BadgeContext`
zu beziehen — dann gäbe es nur noch einen Weg. Nicht gemacht, weil der
Konfi-Weg dabei die volle Abzeichenliste braucht (Fortschritt) und der
Teamer-Weg nur eine Zahl. Wer das angeht, muss beides zusammenbringen.

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
- [x] **Querverweise zwischen den Kapiteln** — erledigt (`e6867f01`), nachgeprueft
      am 26.08.: allein `80-challenges.md` hat 7 Verweise. ALT: heute steht
      jedes Kapitel für sich. *(In Arbeit.)*
- [x] **Konfis einladen per QR-Code und Code** — erledigt (`e6867f01`), dabei
      zwei falsche Angaben gegen den Code korrigiert. ALT: fehlt als Beschreibung
      (heute nur eine Zeile in `30-leitung.md:130` und ein kurzer Abschnitt in
      `35-passwoerter.md`). *(In Arbeit.)*
- [x] **Check-in per QR-Code bei Terminen** — erledigt (`e6867f01`): Ablauf,
      Zeitfenster, Zaehler. ALT: nur als Warnung erwähnt
      (`70-termine.md:146`), nicht erklärt. *(In Arbeit.)*
- [x] Hinweise aus dem Challenge-Erstellen-Modal — standen bereits im Handbuch
      (geprueft 26.08.). ALT: (Abzeichen, Zeitraum,
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
      sind. Der Umbau von Namen auf IDs gehört nach 2.0.0.
      **Erledigt am 26.08.:** Abzeichen 35 ist deaktiviert — die Kategorie
      "Jugend" hat weiterhin 0 Aktivitäten und 0 Termine, das Ziel war also
      unerreichbar. Gegengeprüft: 0 Vergaben in `user_badges`, es wurde
      niemandem etwas weggenommen. Welche Aktivitäten zu "Jugend" gehören,
      ist eine inhaltliche Entscheidung — sobald sie zugeordnet sind, kann
      das Abzeichen in der App wieder aktiviert werden.)*
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

- [x] **Testläufe brechen sporadisch ab** — BEHOBEN am 26.08. (`201b6ee2`).
      Die zweite Spur war die eigentliche: Etliche Routen senden bewusst erst
      die Antwort und erledigen danach Push, Badges und Live-Updates. supertest
      schliesst aber, sobald die Antwort da ist — wurde derselbe Socket dann
      fuer den naechsten Request wiederverwendet, waehrend der vorige Handler
      noch schrieb, landete dessen Rest im naechsten Request. Deshalb traf es
      nie einen bestimmten Test, sondern den, der zufaellig den
      wiederverwendeten Socket erwischte (auch in challenges.js und konfi.js,
      nicht nur events.js — 28 solche Stellen in neun Routendateien).
      *Zwei Massnahmen:* Im Testlauf ist Keep-Alive aus (`tests/setupTests.js`),
      und die fuenf Termin-Handler mit dem laengsten Nachlauf haengen ihre
      Seiteneffekte an `utils/nachAntwort`, der Fehler abfaengt und den Lauf
      abwartbar macht. **Nachgemessen: elf Laeufe hintereinander gruen, je
      1220 Tests** — vorher fiel etwa jeder zweite. Produktionsverhalten
      unveraendert.
      ALT: (etwa jeder vierte). Ursache belegt
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
- [x] **WIDERLEGT: `notifications.test.js` macht echte FCM-Netzwerkaufrufe.**
      Am 26.08.2026 gemessen statt geglaubt: Ein Zähler auf
      `net.Socket.prototype.connect` protokollierte während des GESAMTEN
      Testlaufs (1220 Tests) jede ausgehende Verbindung, die nicht auf
      localhost zeigt — Ergebnis: **keine**. Firebase initialisiert erst beim
      ersten echten Versand (lazy), und den löst kein Test aus. Die
      Schlüsseldatei liegt zwar lokal, ist aber in `.gitignore` und wird im
      Testlauf nie gelesen.

## Notiert, nicht angefasst

- [x] `sitemap.xml` — entsteht jetzt im Handbuch-Generator mit und kennt die
      13 Kapitel (17 Adressen statt 4). Das Datum je Seite kommt aus der
      Quelldatei, nicht aus "heute" (`d3d69767`).
- [x] FAQ dupliziert die Preisliste — die Antwort verweist jetzt auf die
      Tabelle darunter, statt alle Preise ein zweites Mal zu nennen.
- [x] "Das geht 2026 wirklich besser" — jetzt "heute", altert nicht mehr.
- [x] "kein Tracking" — praezisiert auf "kein Tracking in der App", dazu ein
      Satz, dass die Website Aufrufe anonym und cookiefrei zaehlt. Ehrlicher
      als die pauschale Aussage.

---

## Sicherheitsmeldungen von GitHub (24.08. geprüft)

- Dependabot: **0 offene Meldungen**.
- CodeQL: **0 offene** (Stand 26.08.2026). Fuenf Meldungen wurden im Lauf des
  25.08. behoben; die letzte (101) ist als Fehlalarm geschlossen, siehe unten.
  ALT: **6 offene**, alle "high" — jede wird einzeln geprüft, nicht blind
  gefixt. Fehlalarme werden begründet geschlossen, nicht stillgelegt.
  *(In Arbeit.)*
  - [x] 101 `js/missing-rate-limiting` — `docsAuth.js:82`. **FEHLALARM**,
        am 26.08. als solcher geschlossen. Der `docsLoginLimiter` (20
        Fehlversuche/15min, `skipSuccessfulRequests`) wird in `createApp.js`
        vor der Route registriert — CodeQL sieht die Route, nicht die
        vorgelagerte Middleware. *In Produktion gemessen:* ab erschoepftem
        Kontingent antwortet die Route mit 429, `ratelimit-remaining` faellt
        auf 0. Dass es laenger dauerte als erwartet, liegt an zwei
        Backend-Containern mit je eigenem Zaehler — kein Fehler, aber eine
        Falle beim Messen.
  - [ ] 100 `js/insufficient-password-hash` — `docsAuth.js:106`. SHA-256 dient
        dort nur dem zeitkonstanten Vergleich, nicht dem Speichern; CodeQLs
        Lesart greift daneben. Ohne Rate-Limit ist die geringe Rechenzeit
        aber real relevant.
  - [ ] 99 `js/missing-rate-limiting` — `challenges.js:809`
  - [ ] 98 `js/xss-through-dom` — `AudioPlayer.tsx:131`
  - [ ] 97 `js/xss-through-dom` — `ChallengeSubmitModal.tsx:690`
  - [ ] 96 `js/xss-through-dom` — `ChallengeSubmitModal.tsx:625`

---

## Aufträge aus der Löschlogik-Prüfung (26.08.), noch offen

- [x] **Waisen-Cleanup für Altbestand.** ERLEDIGT 26.08.2026, PR #76.
      `node scripts/verwaiste-dateien.mjs` gleicht `uploads/` gegen die
      Datenbank ab — alle VIER Bereiche, nicht nur `challenges/`: requests,
      chat, challenges, material. Prüft beide Richtungen: verwaiste Dateien
      (löschbar) und Datensätze ohne Datei (wird nur gemeldet).
      Ohne `--loeschen` wird nur berichtet; ohne `DATABASE_URL` bricht es ab;
      Waisen unter 7 Tagen bleiben liegen. Die Abfragen filtern bewusst NICHT
      auf `deleted_at` — sonst räumte das Skript genau die Dateien weg, die
      der Soft-Delete für eine Wiederherstellung aufhebt.
      Gegen eine echte Datenbank mit echten Dateien geprüft, Gegenprobe gemacht.

- [x] **Schema-Test gegen fehlende Löschregeln.** ERLEDIGT 26.08.2026, PR #78
      (Wächter) und PR #77 (die dabei gefundenen Lücken).
      Die Prüfung fand **2 echte Lücken** unter 30 Kandidaten, beide bei der
      Org-Löschung, beide brachen das Löschen KOMPLETT ab:
      `event_timeslots.organization_id` (theoretisch) und
      `notifications.organization_id` (über den Multi-Org-Gastfall real
      erreichbar). Die Nutzer-Löschung hat keine Lücke.
      Gemeinsame Ursache: abgeräumt wurde über eine BEZIEHUNG (`event_id`,
      `user_id`) statt über die Spalte, die den Fremdschlüssel trägt.
      **Lehre aus dem Umweg:** Der erste Testentwurf las die Löschroutinen per
      Regex und blieb grün, obwohl beide Lücken offen waren — in
      `... WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)`
      kommt die Spalte vor, gehört aber zum Subquery. Ob ein DELETE die
      richtige Spalte trifft, entscheidet die SQL-Semantik; das gehört in einen
      Test, der die Routine wirklich aufruft (`organizations.test.js`).
      Die Schema-Hälfte bewacht jetzt nur noch, dass keine NEUE Spalte ohne
      Regel dazukommt.

- [x] **Teamer:innen und Termine — ENTSCHIEDEN 26.08.2026: bleibt wie es ist.**
      Die frühere Designentscheidung ("Teamer:innen dürfen Termine anlegen,
      bearbeiten und löschen") ist damit **zurückgenommen**. Teamer:innen legen
      keine Termine an; das macht die Leitung.
      Das **Backend bleibt bewusst unverändert** — die Routen erlauben
      Teamer:innen weiterhin das volle Event-Management
      (`events.js:823/1014/1428` u.a., alle `requireTeamer`). Simons
      Entscheidung: nicht anfassen. Die Oberfläche bietet es nicht an, damit ist
      der Weg praktisch zu.
      **Was daraus folgt, falls das je wieder aufkommt:** Wer die Absicht
      später doch umsetzt, muss auch klären, ob Teamer:innen nur *ihre*
      Jahrgänge bearbeiten dürfen — das Backend prüft bei Events heute nur die
      Organisation, keinen Jahrgang.
      Handbuch (`20-teamer.md:58-60`) und Onboarding beschreiben bereits den
      jetzt gültigen Stand, brauchen also keine Änderung.

---

## Aus den Berichten vom 26.08. (Rollen, Drei Ansichten, Dashboard/Profil)

Drei Prüfläufe, drei Berichte in `docs/agenten-berichte/`. Der schwerste
Befund (fremde Chat-Nachrichten löschbar) ist erledigt, PR #81. Erledigt sind
außerdem: Admins dürfen Teamer:innen und Zertifikate verwalten (PR #82), die
falschen Teamer-Erklärtexte (PR #83).

**Diese Berichte gelten als geschlossen, wenn die Liste hier leer ist.**

**Abgeglichen am 27.08.2026 nachmittags:** Zehn Eintraege standen hier noch
als offen, obwohl sie im Code laengst behoben waren — die meisten mit
Waechtertest. Jeder ist unten einzeln am Code belegt. **Die Befundtexte
beschreiben weiterhin den ALTEN Zustand**, der Erledigt-Vermerk steht jeweils
am Ende. Wer hier liest, liest also erst das Problem und dann die Loesung.
Aus demselben Durchgang: `has_wrapped` stand zweimal drin, einmal erledigt mit
Begruendung und einmal als leere Wiederholung — die Wiederholung ist weg.

### Aus den HOCH-Befunden: erledigt (Stand 27.08.2026)

- [x] **H1 — Abzeichen werden Teamer:innen nie als "neu" gezeigt.** Das
      Backend hat beides fertig (`teamer.js:526` unseen, `:544` mark-seen),
      im Frontend ruft es NIEMAND auf. Der Zähler-Loader bricht für alle
      außer Konfis ab (`MainTabs.tsx:176`), der Teamer-Badges-Tab hat kein
      IonBadge (`:349-352`). Damit bleibt `seen` dauerhaft false.
      Steht seit dem 25.08. als Befund 10 im Abzeichen-Bericht.
      ERLEDIGT (nachgemessen 27.08.2026). `TeamerBadgesPage.tsx:83-103` ruft
      mark-seen auf, der Teamer-Tab hat sein IonBadge (`MainTabs.tsx:344-351`).
      Test: `abzeichenZaehlerTeamer.test.ts`.
      **Der Befundtext oben ist ueberholt:** Den eigenen Zaehler-Loader in
      `MainTabs.tsx:176` gibt es nicht mehr — alle fuenf Zaehler kommen jetzt
      zentral aus `GET /notifications/badge-counts` ueber den `BadgeContext`
      (`MainTabs.tsx:110`).

- [x] **H2 — Teamer-Dashboard zeigt "Teamer gesucht"-Termine nie.** Die Query
      erzwingt `AND eb.id IS NOT NULL` (`teamer.js:880`) und macht damit aus
      dem LEFT JOIN auf die eigene Buchung einen INNER JOIN — es erscheinen
      nur Termine, für die man schon gebucht ist. Der Kommentar darüber
      behauptet das Gegenteil.
      ERLEDIGT (nachgemessen 27.08.2026). `teamer.js:874-902`: Die Bedingung
      ist jetzt `eb.id IS NOT NULL OR teamer_only OR teamer_needed`, der
      Kommentar benennt den Befund. Der Filter auf teamer_only/teamer_needed
      fehlte vorher ganz — ohne ihn stuenden auch reine Konfi-Termine auf der
      Teamer-Startseite.
      **Die Klammerbemerkung zu `LIMIT 5` ist gegenstandslos:** Der Kommentar
      spricht nicht mehr von 3, die 5 ist gewollt.

- [x] **H3 — Termin-Status ignoriert das Teamer-Kontingent, auf drei Ebenen.**
      Backend: `registration_status` rechnet nur mit Konfi-Zahlen
      (`events.js:119-134`), `teamer_max_participants` fließt nicht ein.
      Frontend: `getEventStatusInfo` im Teamer-Baum kennt kein "voll"
      (`TeamerEventsPage.tsx:482-538`) — ein volles Team-Kontingent steht als
      "Offen". Karte: keine Wartelisten-Zahl, obwohl geliefert.
      Folge: Man erfährt erst beim Absenden (400), dass kein Platz ist.
      ERLEDIGT (nachgemessen 27.08.2026), alle drei Ebenen. Backend: eigenes
      Feld `teamer_registration_status` (`events.js:135-160`) neben dem
      Konfi-Status. Frontend: `TeamerEventsPage.tsx:532-545` kennt jetzt
      `closed`/`waitlist`/`upcoming`. Karte: `:1512-1522` zeigt die
      Team-Wartelistenzahl. Test: `teamerKontingentStatus.test.ts`.

- [x] **H4 — Challenge-Freigabe-Zähler übersieht "nur Team"-Challenges.**
      Der Teamer-Zweig zählt nur über Jahrgangszuordnungen
      (`notifications.js:82-93`) und liefert ohne Jahrgänge konstant 0.
      `audience='nur_team'` hat per Definition keine Jahrgangszuordnung.
      Ein Teamer moderiert also eine Team-Runde, wird aber nie darauf
      gestoßen. Der Admin-Zweig ist korrekt.
      ERLEDIGT (nachgemessen 27.08.2026). `notifications.js:83-110`: Der
      Teamer-Zweig laeuft immer, die Bedingung lautet
      `c.audience = 'nur_team' OR EXISTS(...jahrgang...)`. Test in
      `notifications.test.js`.

- [x] **H5 — "Alle bestätigen" fehlt für Teamer:innen.** Die Route nimmt
      `rolle: 'teamer'` entgegen und verbucht dann gezielt ohne Punkte
      (`events.js:2782`, Nutzerentscheid 25.08.). Das Frontend ruft sie ohne
      Body auf und zeigt den Knopf nur über der Konfi-Sektion, bei
      `teamer_only`-Terminen gar nicht. Die Leitung muss einzeln verbuchen,
      und der Termin bleibt im "Verbuchen"-Reiter hängen.
      ERLEDIGT (nachgemessen 27.08.2026). `EventDetailView.tsx:383-407` mit
      `rolle: 'konfi' | 'teamer'` im Body und eigener Rueckfrage ohne
      Punkte-Zusage. Test: `alleBestaetigenTeamer.test.ts` (8 Assertions).
      **Zeilenangabe veraltet:** Die Route steht bei `events.js:2821`, nicht
      mehr bei `:2782`.

- [x] **H6 — Abgesagter Termin: zwei Antworten für denselben Termin.** Die
      Konfi-Liste liefert ihn mit `registration_status='cancelled'`
      (`konfi.js:1224`), der Status-Endpunkt filtert abgesagte raus und
      antwortet 404 (`konfi.js:1316-1322`).
      ERLEDIGT (nachgemessen 27.08.2026). `konfi.js:1347-1352` liefert
      `WHEN e.cancelled THEN 'cancelled'`, und `:1380-1390` laesst abgesagte
      Termine durch, wenn man gebucht war
      (`AND (e.cancelled IS NOT TRUE OR $3::boolean)`).

### Offen aus dem Rollen-Bericht

- [x] **Admin ohne Jahrgangs-Zuweisung sieht eine leere Konfi-Liste.**
      ENTSCHIEDEN 26.08.: Das Verhalten bleibt so. **Der Hinweis ist am
      27.08.2026 nachgezogen** (Simons Entscheidung). Vorher stand dort "Noch
      keine Konfis angelegt" — schlicht falsch, es gibt Konfis, dieser Zugang
      darf sie nur nicht sehen.
      Der Server meldet den Fall per **Header**
      (`X-Kein-Jahrgang-Zugewiesen`), damit die Antwort ein Array bleibt und
      kein Aufrufer bricht — dasselbe Muster wie bei den Abzeichen-Zählern
      (`teamer.js:516`). Die vorhandene `EmptyState`-Komponente zeigt dann
      einen anderen Text.
      **Falle beim Testen, festgehalten:** `rbac.js:13` hält einen
      30-Sekunden-User-Cache. Ein `DELETE` auf die Zuweisungen ändert die
      Datenbank, nicht den Cache — der Test war isoliert grün und im vollen
      Lauf rot. Gelöst mit einem frisch angelegten Admin, den vorher niemand
      geladen hat.

- [ ] **Konfi-Stammdaten (Name, Jahrgang) sind nach dem Anlegen in KEINER
      Ansicht änderbar.** Die Backend-Route existiert
      (`konfi-management.js:269`), hat aber keinen UI-Aufrufer.

### MITTEL aus dem Drei-Ansichten-Bericht

- [x] **M1 — Zusage-Route umging das Teamer-Kontingent.** ERLEDIGT (PR #90).
      Setzte hart `confirmed`, ohne Prüfung von Kapazität oder Warteliste.
      Über die App nicht erreichbar, Route aber offen. Behoben mit
      `determineBookingStatus` — derselben Funktion wie der reguläre Weg.
- [x] **M2 — Tageslosung-Fallback nur zur Hälfte übernommen.** ERLEDIGT
      (PR #90). Konfi bekam Psalm 23, Teamer einen 500er — obwohl der
      Kommentar Gleichheit behauptete. Fallback steht jetzt gemeinsam im
      `losungService`.
- [x] **M3 — "Du hast bereits eingereicht" bedeutet je Baum etwas anderes.**
      ERLEDIGT 27.08.2026. Die Konfi-Liste prüft `has_submission` (eingereicht
      ist eingereicht, auch unmoderiert); die geteilte Leitungs-/Teamer-Liste
      prüfte `has_badge`, das seit dem 24.08. nur noch FREIGEGEBENE Beiträge
      zählt. Bei einer moderierten Challenge sah eine Teamer:in nach dem
      eigenen Einreichen deshalb kein Häkchen, eine Konfi schon — bei
      wortgleichem Tooltip. Jetzt über `own_submission_count`, das der
      Endpunkt seit jeher mitliefert und das im Frontend niemand verwendet
      hat. Da `ChallengesManageView` von beiden Rollen genutzt wird, deckt die
      eine Änderung Leitung und Teamer:innen ab.
      Mitgeändert: Die Legende erklärte das Symbol ausschließlich als
      "Konfi-Sicht" — jetzt rollenneutral, weil es in der eigenen Liste
      genauso erscheint.
- [x] **M4 — Bibelübersetzung: zwei Auswahllisten, RVR60 nur in der privaten
      Konfi-Profil-Kopie.** ERLEDIGT durch PR #93. Am 27.08.2026 nach dem
      Merge nachgemessen: `konfi/views/ProfileView.tsx:51` importiert jetzt
      das geteilte `shared/BibleTranslationModal`, die lokale Kopie ist weg,
      RVR60 kommt im Frontend nirgends mehr vor.
      **Merkposten:** `backend/routes/konfi.js` und `teamer.js` führen RVR60
      weiterhin in `validTranslations`. Das ist folgenlos, solange keine
      Oberfläche es anbietet — wer die Liste per API setzt, bekommt aber eine
      Übersetzung, die die App nicht mehr benennen kann. Aufräumen wäre eine
      Zeile je Datei, gehörte aber nicht zu M4.
- [x] **M5 — Teamer-Profil verwirft die Übersetzungswahl offline
      stillschweigend**, das Konfi-Profil reiht sie in die Warteschlange ein.
      ERLEDIGT 27.08.2026. Jetzt beide über die `writeQueue`.
      **Beim Beheben nachgemessen — es sind VIER Stellen mit DREI
      Verhaltensweisen**, nicht zwei: Konfi-Profil (Warteschlange),
      Teamer-Profil (verwarf still, jetzt Warteschlange), Konfi-Dashboard
      (`DashboardView.tsx:227`) und Teamer-Dashboard
      (`TeamerDashboardPage.tsx:373`) melden beide einen Fehler. Die beiden
      Dashboards sind damit untereinander gleich und scheitern nicht still —
      aber eine offline getroffene Wahl geht dort weiterhin verloren. Falls
      das auch vereinheitlicht werden soll: eigener Auftrag, war nicht Teil
      von M5.
      Der Wächtertest gegen stilles Offline-Scheitern kannte nur
      `if (!isOnline) return` und war für `!networkMonitor.isOnline` blind —
      diese Schreibweise prüft er jetzt mit.
- [x] **M6 — Antrag stellen: Konfi-Weg erzeugt In-App-Mitteilungen für die
      Leitung, Teamer-Weg nur Push.** ERLEDIGT (nachgemessen 27.08.2026).
      `teamer.js:1504-1548` legt jetzt ebenfalls eine In-App-Mitteilung an
      `admin` UND `org_admin` an, zusaetzlich zum Push. Nebenbei wurde der
      Konfi-Weg auf `org_admin` erweitert (`konfi.js:795-800`) — dort fehlte
      die Rolle bisher.
- [x] **M7 — Wrapped: Freigabe-Gate nur im Dashboard, nicht am
      Datenendpunkt.** ERLEDIGT (nachgemessen 27.08.2026).
      `wrapped.js:456-477` prueft die Freigabe jetzt auch in
      `GET /wrapped/me` und antwortet 403 statt durchzureichen. Die Pruefung
      steht bewusst NACH der Snapshot-Pruefung, damit "kein Snapshot"
      weiterhin 404 bleibt. Test in `wrapped.test.js`.
- [x] **M8 — Teamer-Dashboard-Challenges kommen vom Leitungs-Endpunkt ohne
      Audience-Filter.** ERLEDIGT (nachgemessen 27.08.2026).
      `TeamerDashboardPage.tsx:327-343` ruft `/challenges/konfi` auf (den
      Teilnehmer-Endpunkt mit Audience-Filter) statt `/challenges/admin`.
      Test: `teamerDashboardChallenges.test.tsx`.
- [x] **M9 — E-Mail-Änderung: Teamer und Leitung aktualisieren den
      User-Context, Konfi nicht.** ERLEDIGT 27.08.2026. Die Konfi-Ansicht rief
      nur `onReload()` (lädt allein die Profildaten der Seite); Context und
      TokenStore trugen die alte Adresse weiter, bis man sich neu anmeldete.
      Jetzt derselbe Weg wie in den anderen beiden Bäumen, mit Gegenprobe für
      Teamer und Leitung abgesichert.
### NIEDRIG aus dem Drei-Ansichten-Bericht

- [x] **N1 — Zwei Buchungspfade mit unterschiedlichen Guards.**
      ERLEDIGT 27.08.2026 (Simons Entscheidung: beide Prüfungen einbauen).
      Der Bericht hielt das für "praktisch vermutlich folgenlos" —
      **nachgemessen war es das nicht.** `POST /konfi/events/:id/register`
      hatte weder den `teamer_only`- noch den `cancelled`-Guard: Eine Konfi
      konnte sich per API zu einem reinen Teamer-Termin (**200**) und zu einem
      abgesagten Termin (**200**) anmelden. Über die Oberfläche nicht
      erreichbar, weil die Terminliste `teamer_only` für Konfis herausfiltert
      (`events.js:254-256`). Jetzt 403 bzw. 400 wie im regulären Weg
      (`events.js:1666`, `teamer.js:1314`).
      **Der Guard sitzt bewusst nur im POST:** Wer schon angemeldet war, als
      der Termin abgesagt wurde, muss sich noch austragen können — sonst hätte
      die Reparatur Angemeldete eingesperrt. Eigener Test dafür.
      Offen bleibt der dritte Teil des Befunds: Die Timeslot-Zählung im
      Konfi-Pfad zählt ohne Rollenfilter (`konfi.js:1634-1641`), `events.js`
      filtert Teamer heraus. Folgenlos, solange Teamer-Buchungen keine
      `timeslot_id` bekommen — nicht mit angefasst.
- [x] **N2 — Badge-Fortschritt: eine gemeinsame Quelle für Konfis, eine
      250-Zeilen-Inline-Kopie für Teamer.** ERLEDIGT 27.08.2026, beide Teile.
      - [x] **Der Zählfehler in `GET /konfi/badges/stats` ist behoben**
            (27.08.2026). `total_badges` filterte auf `target_role='konfi'`,
            `earned_badges` zählte ALLE Abzeichen der Person — derselbe
            Fehler, der am 24.08. in `konfiBadgeProgress.js:117-126` behoben
            wurde, in der Nachbar-Query aber nicht. Bei einer Beförderung
            Konfi→Teamer bleiben die Abzeichen bestehen
            (`konfi-management.js:1136`), wer danach Teamer-Abzeichen
            verdiente, bekam mehr "verdiente" als überhaupt vorhandene.
            **Der Endpunkt hatte keinen Test UND keinen Aufrufer** — deshalb
            fiel es nie auf. Beides war Grund, ihn abzusichern statt ihn
            liegenzulassen: Wer ihn als nächstes einbindet, hätte den Fehler
            geerbt.
      - [x] **Die Inline-Kopie ist aufgeloest** (27.08.2026). Vor dem Umbau
            wurden beide Pfade verglichen, weil "angleichen" hier leicht
            Absicht zerstoert haette. Ergebnis: Die ZAEHL-Queries sind
            fachlich verschieden und bleiben getrennt — Konfis haben
            Punktekonten und Pflichttermine, Teamer:innen gezaehlte
            `target_role='teamer'`-Aktivitaeten und Dienstjahre. Eine
            Funktion mit Rollen-Schalter waere die Kopie mit einem `if`
            davor gewesen.
            Gemeinsam ist jetzt der Rechenkern: `utils/badgeProgress.js` mit
            `berechneBadgeProgress` (rechnet aus fertigen Zaehlern) und
            `bedingungFehlt`. Netto 107 Zeilen weniger bei mehr Kommentar.
            **Die Antwortform des Teamer-Pfads blieb bewusst unangetastet**
            (flaches Array, `progress_points`/`progress_percentage`, Zaehler
            in Kopfzeilen): Zwei Ansichten und vier Tests haengen daran, ein
            Formwechsel haette aus einem risikoarmen Umbau einen mit
            Frontend-Regressionsrisiko gemacht. Er bleibt als eigene,
            spaetere Aufgabe offen (siehe unten).
            **Drei echte Fehler kamen dabei heraus**, keine blossen
            Doppelungen:
            1. Das JSON-Parsen von `criteria_extra` stand im Teamer-Pfad
               OHNE Auffangnetz — ein einziger beschaedigter Datensatz haette
               die ganze Abzeichen-Seite in den 500 laufen lassen. Der
               Konfi-Pfad fing es ab.
            2. Die Zaehler pro Kategorie/Aktivitaetsname waren ein Plain
               Object; eine Kategorie namens `constructor` haette eine
               Funktion statt einer Zahl geliefert. Der Konfi-Pfad nutzte
               laengst eine `Map`.
            3. Der Geheim-Zaehler zaehlte beim Teamer auch ABGESCHALTETE,
               aber verdiente Abzeichen mit — dieselbe Zahl bedeutete je nach
               Rolle etwas anderes. Auf den Konfi-Weg angeglichen (Simons
               Entscheidung): nur aktive.
            Dazu die **"unerreichbar"-Ausblendung fuer Teamer:innen** (Simons
            Entscheidung): Ein Abzeichen ohne hinterlegte Bedingung wird nicht
            mehr ausgeliefert, wie bei den Konfis. Verdiente bleiben sichtbar.
            Die Punktearten-Haelfte der Konfi-Pruefung gilt hier NICHT —
            Teamer:innen haben kein Punktekonto.
            **Eine Namensfalle war der Grund fuer das Zaehler-Objekt:** Beide
            Pfade hatten eine Variable `activityCount`. Beim Konfi sind Events
            NICHT enthalten und werden addiert, beim Teamer schon. Gleicher
            Name, andere Bedeutung — im Kern heisst das Feld deshalb
            `aktivitaetenUndEvents`, der Aufrufer muss sich entscheiden.
            Abgesichert durch 40 Einheitstests ohne Datenbank
            (`tests/utils/badgeProgress.test.js`), gegen Mutation geprueft.
            **Mitbehoben, weil der Umbau es sichtbar machte:** Die Anzeige
            "x von y Abzeichen" im KONFI-Dashboard zaehlte auch die
            ausgeblendeten unerreichbaren mit — der Nenner kam aus einer
            eigenen Query, die organisationsweit zaehlte und von der
            Ausblendung nichts wusste. Bei zehn bedingungslosen Abzeichen in
            Org 1 stand dort ein Ziel, das niemand vollmachen konnte. Gezaehlt
            wird jetzt aus der geladenen Liste, wo `unreachable` bekannt ist,
            mit `is_active`-Filter (verdiente abgeschaltete bleiben sichtbar,
            zaehlen aber nicht als offenes Ziel). Die eigene Statistik-Query
            entfaellt damit — eine Abfrage weniger pro Aufruf.

- [ ] **Antwortform der Teamer-Abzeichen vereinheitlichen.** Aus N2
      abgetrennt. Der Teamer-Pfad liefert ein flaches Array plus
      `X-Badges-Secret-Total`/`X-Badges-Visible-Total` in Kopfzeilen, der
      Konfi-Pfad `{available, earned, stats}`. Daran haengen
      `TeamerBadgesPage.tsx:52-62` und `TeamerDashboardPage.tsx:278-288`
      (beide lesen die Kopfzeile und normalisieren Feldnamen) sowie vier
      Tests in `teamer.test.js`. Geschaetzt 3 Stunden.
      Nebenbefund: **`X-Badges-Visible-Total` liest niemand** — beide
      Ansichten zaehlen aus der Liste. Die Kopfzeile ist eine Zusage der
      Schnittstelle ohne Nutzer; beim Vereinheitlichen mitentscheiden.
- [x] **N3 — Anträge lesen: `target_role`-Filter nur beim Teamer.**
      ERLEDIGT 27.08.2026. **War mehr als eine Anzeige-Divergenz.** Vor dem
      Beheben nachgemessen: Der Konfi-Weg filterte weder beim Lesen NOCH beim
      Anlegen. Eine Konfi konnte per API einen Antrag auf eine
      Teamer-Aktivität stellen (POST → **201**), er erschien in ihrer Liste
      (**1 Treffer**) und die Leitung konnte ihn bestätigen — Punkte aus einer
      Aktivität, die nicht für Konfis gedacht ist. Über die Oberfläche nicht
      erreichbar, weil die Auswahlliste dort filtert; per API offen.
      Der Bericht hatte nur den Lesepfad genannt; die eigentliche Lücke lag am
      Anlege-Weg (`konfi.js:711`). Beide sind jetzt zu, mit Tests für den
      verbotenen UND den erlaubten Fall.
      **Der `LEFT JOIN` bleibt bewusst ein `LEFT JOIN`** (der Bericht führte
      ihn als Divergenz auf): Beim Teamer fällt ein Antrag zu einer gelöschten
      Aktivität aus der Liste, beim Konfi bleibt er mit leerem Namen stehen.
      Anzeigen ist besser als Verlieren — der Filter greift deshalb nur, wenn
      überhaupt eine Aktivität vorliegt. Durch einen eigenen Test
      festgehalten. Wer die beiden Wege angleicht, sollte den Teamer-Weg auf
      LEFT JOIN umstellen, nicht umgekehrt.
- [x] **N4 — org_admin kann an Challenges teilnehmen, hat aber keine eigene
      Abzeichen-Ansicht.** GEPRÜFT UND BEWUSST GESCHLOSSEN 27.08.2026
      (Simons Entscheidung). Der Bericht markierte ihn selbst als unsicher
      ("Unsicher, ob bewusst"). Nachgesehen — **der Befund geht in die
      falsche Richtung:**
      - Challenge-Abzeichen sind KEINE `custom_badges`. `badge_name` und
        `badge_icon` hängen an der Challenge selbst, es gibt kein
        `INSERT INTO user_badges`. Sie erscheinen in den Challenge-Ansichten,
        nicht auf den Abzeichen-Seiten. Die 403 bei `/teamer/badges` betrifft
        sie also gar nicht.
      - `custom_badges.target_role` kennt nur `konfi` und `teamer`
        (`badges.js:150,347`). Die Teamer-Kriterien (`teamer_year`, gezählte
        Aktivitäten mit `target_role='teamer'`) treffen auf Leitungsrollen
        nicht zu.
      Eine Abzeichen-Ansicht für `admin`/`org_admin` wäre heute also eine
      leere Seite. Die 403 ist richtig. Wer das ändern will, braucht zuerst
      Abzeichen-Kriterien für Leitungsrollen — eigener Auftrag.
- [x] **N5 — Leitung kann das Konfi-Wrapped nicht ansehen, obwohl das Backend
      es ihr erlaubt.** ERLEDIGT 27.08.2026 (Simons Entscheidung: bauen, in
      der Konfi-Detailseite). Die Karte erscheint dort nur, wenn ein Snapshot
      vorliegt. **Kein zusätzliches Freigabe-Gate nötig**, weil
      Snapshot-Erzeugung und `wrapped_released_at` in derselben Transaktion
      laufen (`wrapped.js:513-537`) — ein Konfi-Snapshot existiert nie vor der
      Freigabe. Diese Kopplung ist jetzt durch Backend-Tests festgehalten;
      fällt sie, wird aus der Ansicht eine Datenschutzlücke.
      Nebenbei gehärtet: Der History-Test hatte ein `if (res.body.length > 0)`
      und wäre bei kaputter Generierung still grün geblieben.
- [x] **N6 — Termin-Detail-Divergenzen quer durch die Bäume.** ERLEDIGT
      27.08.2026. Der Bericht listete ACHT eigenständige Punkte; alle acht
      sind gebaut, jeder einzeln unten belegt.
      **Was der Durchgang gezeigt hat:** Die Registernotiz "reine
      Frontend-Änderung" beim Event-Chat war falsch. Konfi und Teamer öffnen
      ihr Termin-Detail nicht über die Detail-Route, sondern greifen sich den
      Termin aus der schon geladenen Liste — was die Liste nicht ausgibt,
      haben sie nicht. **Wer eine Anzeige für diese beiden Ansichten ergänzt,
      prüft zuerst, ob das Feld in der LISTE steht**, nicht nur in
      `GET /events/:id`. Dasselbe begrenzte auch die Serien-Anzeige.
      - [x] **"Vergangen"-Berechnung** (27.08.2026). Nachgemessen: Ob ein
            Termin vorbei ist, wurde an **elf Stellen** einzeln gerechnet —
            und nur an **einer** davon richtig. Zehn nutzten allein
            `event_date` (den START), obwohl mehrtägige Termine erst nach
            `event_end_time` vorbei sind. Bei einer Freizeit vom 10. bis 14.
            sagte die Konfi-Liste am 11. noch "läuft", die Detailansicht
            desselben Termins schon "vergangen".
            Die Begründung stand bereits zweimal im Code
            (`konfi/views/EventsView.tsx`, `admin/pages/AdminEventsPage.tsx`)
            — nur eben nicht an den anderen neun Stellen. Jetzt einmal in
            `shared/eventFormatting.ts` als `istVergangen()`/`eventEnde()`,
            alle elf Stellen darauf umgestellt. Auch die beiden lokalen
            `eventEndDate`-Kopien (gleiche Logik, anderer Name) zeigen jetzt
            dorthin.
      **Simons Entscheidungen vom 27.08.2026 mittags zu allen sieben:**
      - [x] **Anmeldezeitraum fehlt nur im Teamer-Detail.** ERLEDIGT
            27.08.2026. Derselbe Block wie bei Leitung und Konfi, gleiche
            Formulierung ("Sofort möglich", wenn kein Beginn gesetzt ist).
      - [x] **Serien-Kennzeichnung (`is_series`) sieht nur die Leitung.**
            ERLEDIGT 27.08.2026, in Konfi- und Teamer-Detail als eigene Zeile
            "Terminreihe · Teil einer Serie".
            **Bewusst NUR die Kennzeichnung, nicht die Terminübersicht:** Die
            weiteren Termine der Reihe stehen in `series_events`, und das
            liefert allein `GET /events/:id`. Konfi und Teamer lesen ihren
            Termin aus der LISTE (siehe nächster Punkt) und haben das Feld
            nicht. Wer die Übersicht auch dort will, braucht denselben
            LATERAL-Weg wie beim Chat.
      - [x] **Einstieg in den Event-Chat hat nur die Leitung** ERLEDIGT
            27.08.2026 — aber **nicht als reine Frontend-Änderung**, wie hier
            notiert war. Nachgemessen: Konfi und Teamer öffnen ihr "Detail"
            gar nicht über `GET /events/:id`, sondern greifen sich den Termin
            aus der schon geladenen LISTE (`TeamerEventsPage.tsx:455`
            `(await api.get('/events')).data.find(...)`). Und `chat_room_id`
            liefert **nur die Detail-Route** (`events.js:853`), keine der
            beiden Listen.
            Gebaut: ein `LEFT JOIN LATERAL` in beiden Listen (`events.js`,
            `konfi.js`), das `chat_room_id` **nur bei bestehender
            Mitgliedschaft** in `chat_participants` ausgibt. Damit bildet der
            Knopf genau die Berechtigung ab, die `darfRaumOeffnen`
            (`chat.js:273`) durchsetzt — ein Knopf ins 403 entsteht nicht.
            **Der Knopf öffnet nur, er erstellt nie** (Simons Entscheidung):
            `POST /events/:id/chat` verlangt `requireTeamer`, Erstellen bleibt
            der Leitung. Ohne Raum erscheint kein Knopf.
      - [x] **Admin-Detail berechnet `registration_status` lokal** ERLEDIGT
            27.08.2026, nutzt jetzt den Backend-Wert wie die eigene Liste.
            Beim Umstellen fielen **zwei Folgefehler** an, die die lokale
            Rechnung verdeckt hatte:
            `mandatory` kannte sie nicht (ein Pflichttermin wäre in den
            Fallback "Geschlossen" gefallen — jetzt "Pflichttermin"), und die
            Warteliste-Zweige fragten `regStatus === 'closed'`, obwohl das
            Backend bei freier Warteliste weiter `'open'` meldet
            (`events.js:129-131`) — der Zweig hätte nie mehr gegriffen. Beide
            hängen jetzt an der Kapazität statt am Status.
      - [x] **Punktezeile: drei verschiedene Bedingungen** ERLEDIGT
            27.08.2026, `points > 0`-Guard ergänzt.
            Mit erledigt (Simons Entscheidung beim Nachfragen): die
            **Punkte-Kachel** oben im Leitungs-Detail
            (`EventDetailView.tsx:728`) zeigte dieselbe "0". Sie weicht bei
            punktlosen Terminen jetzt auf die Abgemeldeten aus — dieselbe
            Ausweichlogik, die die Ansicht bei vergangenen Terminen schon hat.
      - [x] **`checkin_window` wird nur im Formular gesetzt** ERLEDIGT
            27.08.2026, Zeile in **allen drei** Detailansichten, Formulierung
            wörtlich aus dem Formular (`EventFormSections.tsx:223`).
      - [x] **Abmeldefrist (2 Tage) hartcodiert** → BLEIBT HARTCODIERT
            (Simons Entscheidung). **Nicht zu verwechseln mit dem QR-Code** —
            das ist `checkin_window`, eine Zeile darüber. Hier geht es darum,
            bis wann eine Konfi sich selbst wieder ABMELDEN kann; danach ist
            der Knopf gesperrt ("Abmelden geht nur bis 2 Tage vorher").
            Zwei Fundstellen, die zusammenpassen müssen:
            `konfi/views/EventDetailView.tsx:276` und `konfi.js:1812`.
            Offen bleibt nur: **im Handbuch erklären**, damit die Leitung weiß,
            warum Konfis sich kurz vorher nicht mehr abmelden können.
- [x] **N7 — `TeamerChallengesPage.tsx` ist eine Zeilenkopie von
      `AdminChallengesPage.tsx`.** ERLEDIGT 27.08.2026 (Simons Entscheidung:
      zusammenführen). Gemessen wichen die beiden in **24 von rund 197
      Zeilen** ab, größtenteils Kommentare; echte Unterschiede waren nur
      Cache-Key, Modal-ID, Importpfade und der Komponentenname. View und
      Modals waren ohnehin schon geteilt.
      Die Seite steht jetzt einmal in `shared/ChallengesPage.tsx`; die beiden
      Dateien bleiben als dünne Hüllen, damit Routen und Importpfade
      unverändert sind. Ein Test hält fest, dass sie dünn BLEIBEN — sonst
      wächst die Kopie unbemerkt nach.
      **Zwei Dinge mussten getrennt bleiben:** der Cache-Key (der
      Teamer-Schlüssel hängt zusätzlich an der Person, weil das Backend nach
      zugewiesenen Jahrgängen filtert — zwei Teamer:innen derselben
      Organisation sehen NICHT dasselbe) und die Modal-Seiten-ID (sonst
      vermischen sich die Modal-Stapel). Beides durch eigene Tests
      abgesichert.
      Aus demselben Befund mit erledigt: `PushNotificationSettings` wurde in
      `MainTabs.tsx` importiert und nirgends gerendert — Import entfernt.
      **Die Komponente selbst (238 Zeilen) ist damit nirgends mehr
      referenziert** und bewusst stehen gelassen, statt sie ungefragt zu
      löschen.

- [x] **Org-weite Wartelisten-Einstellungen sind tote Felder.**
      ENTFERNT (27.08.2026, Simons Entscheidung). Aus N7 mitgeprüft und
      bestätigt: `waitlist_enabled` und `max_waitlist_size` wurden in
      `settings.js` geschrieben und gelesen, aber von **keiner Buchungslogik**
      verwendet — die Wartelisten-Logik hängt ausschließlich an den
      gleichnamigen Feldern des jeweiligen Termins. Eine Oberfläche gab es
      dafür ebenfalls nicht.
      Entfernt wurden: die Validierung, der Lese-Zweig (Integer-/Boolean-
      Aufbereitung) und die beiden Schreib-Zweige in `settings.js`, die Felder
      im Request-Body der API-Doku sowie die vorhandenen Zeilen per Migration
      131. Anders als bei den Termin-Feldern waren das keine Spalten, sondern
      Zeilen in der key/value-Tabelle `settings` — vor dem Entfernen in
      Produktion nachgemessen: **0 Zeilen**, es hatte also nie jemand einen
      Wert gesetzt.
      **Die gleichnamigen Felder an `events` blieben unangetastet**
      (`events.waitlist_enabled`, `events.max_waitlist_size` und die
      `teamer_`-Varianten). An ihnen hängt die produktive Wartelisten-Logik;
      ein neuer Test belegt, dass eine volle Veranstaltung mit Warteliste
      weiterhin auf die Warteliste setzt.
- [ ] **N8 — `bible_translation` liegt je Rolle in einer anderen Tabelle.**
      Der Befund hat ZWEI Teile:
      - [x] **Die spürbare Folge ist behoben** (27.08.2026).
      - [ ] **Die Doppelspalte bleibt** (siehe unten).

      Bestätigt: Konfis speichern in `konfi_profiles.bible_translation`
      (`konfi.js:2062`), Teamer in `users.bible_translation` (Migration 107,
      weil Teamer kein `konfi_profile` haben). Bei einer Beförderung wurde die
      Wahl nicht mitgenommen — die Teamer-Ansicht las die noch leere
      users-Spalte, die Tageslosung sprang still auf LUT zurück.
      Die Beförderung überträgt sie jetzt in derselben Transaktion
      (`konfi-management.js`, Schritt 10). Die Quelle bleibt bewusst stehen:
      Das `konfi_profile` bleibt insgesamt bestehen, bei einer Rückstufung ist
      die Wahl damit noch da. Eigener Test dafür.
      **Offen bleibt die eigentliche Ursache:** zwei gleichnamige Spalten für
      dieselbe Präferenz. Das Zusammenführen braucht eine Datenmigration und
      Anpassungen an allen vier Lesestellen — eigener Auftrag, nicht nebenbei.
      Bis dahin ist die Falle wenigstens dokumentiert und die Folge weg.

### Offen aus dem Rollen-Bericht (MITTEL/NIEDRIG)

- [x] **Handbuch widerspricht sich beim Gruppen-Anlegen selbst.** ERLEDIGT
      27.08.2026. `90-chat.md:39` sagte "Nur die Leitung legt Gruppen an",
      `20-teamer.md:34` "Du kannst Gruppenchats anlegen". Am Code geprüft:
      Das Teamer-Kapitel hatte recht — `chat.js:442-450` beschränkt nur
      **Konfis** auf Einzelchats. `90-chat.md` korrigiert; dabei gleich
      ergänzt, dass Mitglieder nachtragen der Leitung vorbehalten bleibt und
      die Mitgliederliste allen offensteht.
- [x] **Material-Tags: komplette Backend-Verwaltung ohne jede Oberfläche.**
      ERLEDIGT 27.08.2026 (Simons Entscheidung: entfernen). Bestätigt:
      vollständiges CRUD, Zuordnungstabelle und `tag_id`-Filter im Backend —
      null Zeilen Oberfläche, kein Wort im Handbuch.
      **Vor dem Entfernen in Produktion nachgemessen:** `material_tags` 1
      Zeile ("Spiele", Org 1), `material_file_tags` **0** Zeilen. Ein
      Test-Überbleibsel ohne Zuordnung — es ging nichts verloren.
      Migration 130 räumt beide Tabellen ab. In der API-Doku steht an Stelle
      des Routen-Blocks ein Vermerk mit Datum und Messwerten, damit
      nachvollziehbar bleibt, dass es die Routen gab.

- [x] **Mitgliederliste im Chat:** Backend offen, UI nur für Admins, Handbuch
      verspricht sie Konfis. ERLEDIGT 27.08.2026 (Simons Entscheidung:
      freigeben, Gates trennen). Alle drei Teile des Befunds bestätigt: Das
      Backend gibt die Teilnehmerliste seit jeher jedem Raum-Mitglied frei
      (`chat.js:1336`, geprüft wird nur `darfRaumOeffnen`), der Knopf hing am
      `isAdmin`-Gate — **zusammen mit "Umfrage erstellen", also zwei
      verschiedene Rechte an einem Schalter** — und das Handbuch verspricht
      sie Konfis ausdrücklich (`10-konfis.md:46`).
      Jetzt sehen alle Raum-Mitglieder die Liste, Umfragen anlegen bleibt bei
      der Leitung. In Einzelchats bleibt der Knopf weg (dort weiß man, wer
      dabei ist).
      **Vor dem Freigeben geprüft:** Das Modal enthält auch Verwaltungsaktionen
      (entfernen, hinzufügen). Die hängen an einem eigenen Gate
      (`canManageMembers`, `MembersModal.tsx:271`) und bleiben bei der
      Leitung — sonst hätte das Öffnen der Liste versehentlich die Verwaltung
      mit freigegeben. Der Endpunkt liefert Anzeigename, Rolle, Jahrgang und
      Beitrittsdatum, keine Kontaktdaten.

- [x] **Teamer-Kapitel im Handbuch verschweigt das Challenge-Löschen.**
      ERLEDIGT 27.08.2026. Bestätigt: `DELETE /challenges/admin/:id` läuft
      unter `requireTeamer` (`challenges.js:1408`), die Oberfläche bietet es
      an — das Handbuch nannte es nicht. Ergänzt, samt dem Unterschied
      zwischen Entwurf (direkt weg) und laufender Challenge (Rückfrage, dann
      Beiträge und Dateien mit).
- [x] **Benutzerseite per Deep-Link für Admins erreichbar**, Aktionen liefen
      in 403. *Teilweise entschärft durch PR #82.* ERLEDIGT 27.08.2026.
      Die Route `/admin/users` ist ungegatet, der UI-Einstieg
      org_admin-exklusiv. Wer die Adresse kannte, sah in der Liste
      Lösch-Wische, die allein an `can_edit` hingen — angetippt liefen sie in
      einen 403 (`users.js:385`, `requireOrgAdmin`).
      **Die Absicherung war halb da:** Der Anlegen-Knopf prüfte die Rolle seit
      jeher (`AdminUsersPage.tsx:121`), die Liste darunter nicht. Jetzt reicht
      die Seite `darfVerwalten` durch; `can_edit` bleibt zusätzlich erhalten
      (eigene Gegenprobe).
      **Serverseitig war es nie eine Lücke** — `requireOrgAdmin` hielt. Es
      ging um Aktionen, die sichtbar sind und dann scheitern.


- [x] **Teamer-Bonuspunkte per API ohne Jahrgangs-Grenze.** ERLEDIGT
      27.08.2026. Nachgemessen, bevor es repariert wurde: Eine Teamer:in
      konnte per API Bonuspunkte an eine Konfi eines **fremden Jahrgangs**
      vergeben — POST → **201**, Eintrag angelegt. Das widersprach
      `assign-activity` (prüft den Jahrgang) und dem Handbuch, das
      ausdrücklich "Kein Zugriff auf diesen Konfi" verspricht
      (`45-jahrgaenge.md:180`). Über die Oberfläche nicht erreichbar, weil die
      Teamer-Ansicht keine Punktevergabe hat — bekommt sie eine, wäre die
      Lücke sofort real gewesen.
      Jetzt derselbe Check wie in `assign-activity`, mit demselben Wortlaut.
      Die Leitung bleibt org-weit berechtigt (eigene Gegenprobe).
      Nebenbei korrigiert: Die API-Doku nannte für diese Route **200**, der
      Code antwortet mit **201** (`konfi-management.js:861`).

- [x] **"Direktvergabe über die Aktivitäten-Seite" hat keinen UI-Aufrufer**,
      das Handbuch beschreibt sie trotzdem im Detail. ERLEDIGT 27.08.2026.
      Nachgeprüft: `assign-activity` hat **null Aufrufer** im Frontend; es
      gibt nur den Weg über die Konfi-Verwaltung
      (`ActivityModal.tsx:135`). Das Handbuch stellte beide Wege in einer
      Tabelle gegenüber und **empfahl sogar den nicht existierenden**
      ("nimm den Weg über die Aktivitäten-Seite"). Abschnitt auf den echten
      Weg umgeschrieben; die Angaben dazu (Kommentar ja, Abzeichen ja, Push
      nein, Level nein) am Code gegengeprüft und bestätigt.
      **Hinweis:** Der Endpunkt bleibt bestehen. Bekommt die Teamer-Ansicht
      je eine Punktevergabe, ist er der Weg dorthin — dann gilt auch der
      Jahrgangs-Check, den er im Gegensatz zu den Bonuspunkten schon hat.

### Aus dem Dashboard/Profil-Durchgang

- [x] **DM1 — Teamer-Onboarding versprach "Umfragen erstellen".** ERLEDIGT
      (PR #83).
- [x] **DM2 — Mitmachen-Erklärung zeigte Teamer:innen den Slide der
      Leitung.** ERLEDIGT (PR #83).
- [x] **KonfiOnboardingModal nutzt die geteilte OnboardingTour.** ERLEDIGT
      (PR #93). War eine Render-Vollkopie; jetzt nur noch die sieben
      Konfi-Slides, 85 statt 279 Zeilen.
- [x] **super_admin fällt im Chat zwischen drei verschieden definierte
      "Leitung"-Gates** — sieht den Mülleimer, bekommt vom Backend 403.
      ERLEDIGT 27.08.2026. Ursache am Code nachgesehen: `istLeitung` wurde für
      den **Export** gebaut (dort ist `super_admin` richtig) und dann für den
      Mülleimer mitbenutzt — **zwei Rechte an einer Variable**, dasselbe
      Muster wie bei der Mitgliederliste im Chat.
      **Das Backend hat recht**, nicht das Frontend: `chat.js:2304-2305` lässt
      beim Leeren nur `admin` und `org_admin` durch, und das passt zur Rolle —
      `super_admin` ist organisationsübergreifend und für die Org-*Verwaltung*
      zuständig (`rbac.js:57`); Inhalte einer fremden Gemeinde zu löschen
      gehört nicht dazu.
      Eigenes, engeres Gate für den Mülleimer. Der Export behält
      `super_admin` (eigene Gegenprobe) — das Trennen war der Punkt, nicht das
      Verengen von beidem.
- [ ] **Admin-Startseite zeigt nur eine der beiden Neuerungs-Karten.**
- [x] **Konfi-`has_wrapped` prüft nur die Freigabe, nicht die
      Snapshot-Existenz.** ERLEDIGT 27.08.2026.
      Nachgemessen: Bei gesetzter Freigabe ohne Snapshot lieferte das
      Dashboard `has_wrapped: true`, `GET /wrapped/me` aber **404** — die
      Konfi sah den Einstieg zum Jahresrückblick und tippte ins Leere.
      **Das kann wirklich passieren**, anders als bei N5: Die
      Snapshot-Erzeugung läuft über `Promise.allSettled`
      (`wrapped.js:735-739`), zählt Fehler mit (`errors`) und setzt die
      Freigabe **trotzdem**. Scheitert sie für eine einzelne Konfi, hat genau
      diese eine Freigabe ohne eigenen Snapshot.
      Jetzt müssen beide Bedingungen gelten. Vier Gegenproben: Snapshot ohne
      Freigabe zeigt weiterhin nichts, der Snapshot einer *anderen* Konfi
      zählt nicht (sonst hätte der Join die Bedingung faktisch aufgehoben),
      und ein eigener Test hält fest, dass Dashboard und `/wrapped/me`
      dieselbe Antwort geben.

- [x] **Veraltete Fallback-Defaults in `settings.js:83-84`** (nur bei
      kaputtem JSON relevant). ERLEDIGT 27.08.2026. Bestätigt: Es fehlten
      `challenges` und `konfispruch` — beide längst Teil der Dashboards. Wer
      in diesen Fall geriete, verlöre sie stillschweigend.
      **Warum es überhaupt veralten konnte:** Die Listen greifen nur, wenn der
      gespeicherte Wert kein gültiges JSON ist, also praktisch nie. Genau
      deshalb fiel es nicht auf.
      Jetzt an die Dashboard-Fallbacks angeglichen (`konfi.js:306`,
      `teamer.js:960`) — gespiegelt, nicht neu erfunden. Ein Test hält die
      Übereinstimmung fest und prüft dabei nur die *Menge* der Abschnitte,
      nicht ihre Reihenfolge; die ist Geschmackssache. Gegenprobe: Konfis und
      Teamer:innen behalten unterschiedliche Listen — angleichen heißt nicht
      gleichmachen.
      **Kein CHANGELOG-Eintrag:** Der Fall tritt praktisch nie ein.

### Aus dem Abzeichen-Zähler-Bericht (27.08.)

- [x] **B1 — Der KONFI-Abzeichen-Zähler setzt sich in laufender Sitzung nie
      zurück.** ERLEDIGT durch die Zähler-Konsolidierung (PR #92), am
      27.08.2026 nachgeprüft: `KonfiBadgesPage.tsx:113` ruft nach `mark-seen`
      jetzt `refreshAllCounts()`. War kaputt seit `33e3364` (03.07.2026,
      Wegfall des 60s-Pollings); der Teamer-Weg machte es richtig, die alte
      Konfi-Seite wurde nicht nachgezogen.
      **Wichtig:** Die Dokumentation der Falle (siehe oben) hat diesen Fehler
      NICHT verhindert; er bestand schon vorher unbemerkt.
      Deshalb war der Umbau richtig statt nur ein Kommentar.
- [x] **B2 — Das App-Icon hat vier Schreiber mit drei Semantiken.**
      ERLEDIGT 27.08.2026 (B2a mit PR #92, B2b jetzt).
      **B2b, nachgemessen:** Der Chat-Push setzte die **Chat-Unread-Zahl
      allein** aufs Icon (`chat.js:1105,1905`) und überschrieb damit Anträge,
      Termine, Freigaben und Abzeichen — nach einer Chat-Nachricht zeigte das
      Icon nur noch die Chat-Zahl. Alle anderen Pushes fielen auf `badge: 1`
      zurück. Nur der Client kannte die echte Summe, konnte sie bei
      geschlossener App aber nicht setzen.
      **Simons Entscheidung: der Server rechnet.** Begründung: Bei
      geschlossener App gibt es keinen Client — und genau dann ist das Icon
      das Einzige, was jemand vor dem Öffnen sieht. Den Badge aus den Pushes
      zu entfernen hätte es dort einfrieren lassen.
      Die Summe steht jetzt einmal in `utils/appIconBadge.js`, mit derselben
      Aufteilung je Rolle wie `BadgeContext.totalBadgeCount`. Ein
      **Paritätstest** vergleicht sie gegen den `badge-counts`-Endpunkt, aus
      dem der Client seine Zahlen bildet.
      **Beim Gegenproben aufgefallen und nachgebessert:** Die Tests deckten
      zuerst nur die *Berechnung* ab — die *Verdrahtung* im Push-Weg wäre
      unbemerkt zurückgefallen. Genau dort saß der Fehler. Ein eigener Test
      prüft jetzt beide Sendestellen, inklusive des Unterschieds: In
      `sendToUser` gewinnt ein ausdrücklich übergebener Wert, in
      `sendChatNotification` wird er ersetzt (er ist per Definition zu
      niedrig).
      Offen bleibt der vierte Schreiber: der 5-Minuten-Hintergrund-Sync
      (`backgroundService.js`) setzt weiterhin nur Chat-Unread. Er läuft nur
      bei geöffneter App, wo der Client ohnehin korrigiert — deshalb hier
      nicht mit angefasst.
- [ ] **Konsolidierung der Zähler.** Der in der Falle-Notiz vermutete Haken
      existiert NICHT: Der Zähler braucht die Fortschrittsberechnung gar
      nicht, `user_badges.seen` liegt für beide Rollen in derselben Tabelle.
      Eine COUNT-Abfrage als fünftes Feld `newBadges` in `badge-counts` deckt
      beides ab — gemessen 101–112 ms, im Rauschen des Endpunkts.
      Löscht netto Code, macht den intuitiven `refreshAllCounts()`-Aufruf zum
      richtigen und erledigt B1 gleich mit.

### Die Klasse dahinter

Beide Berichte kommen unabhängig zum selben Schluss: **Wo eine Komponente
GETEILT wird, gibt es keine Lücken. Wo kopiert wurde, driftet es.**
Challenges sind seit dem Umbau vom 22.08. sauber, weil dort geteilte
Komponenten benutzt werden. Entwarnung dagegen bei den doppelten
ChangeEmail-/ChangePassword-Modalen: kein funktionaler Drift, nur Styling.

Beim Beheben der Befunde oben deshalb: erst prüfen, ob sich die Konfi-Variante
teilen lässt, statt eine dritte Kopie anzulegen.

### Abgeschlossene Prüfläufe

Vollständig abgearbeitet, es steht nichts mehr offen:

- **Chat-Löschlogiken** (26.08.) — PRs #73, #74, #75. Die eine Fehlbewertung
  darin ("Nachrichten-Löschen konsistent gelöst") wurde beim Gegenlesen
  widerlegt und über PR #81 behoben.
- **Löschlogiken gesamt** (26.08.) — PRs #72 bis #75, dazu Waisen-Skript
  (#76) und Fremdschlüssel-Wächter (#77, #78). Zwei Punkte bewusst offen:
  Abzeichen aberkennen und die nicht-atomare Löschreihenfolge.
- **Punkteart ausblenden** (26.08.) — PR #79.
- **Dashboard/Profil-Durchgang** (26./27.08.) — Chat-Lücke (#81) und die zwei
  falschen Teamer-Texte (#83); der Rest waren Entwarnungen.
- **Abhängigkeiten und Ionic** (27.08.) — Themes aktualisiert, Ionic 9 als
  eigenes Vorhaben eingeplant (siehe "Nach 2.0.0"). Der beauftragte Bericht
  wurde vom Agenten allerdings NIE geschrieben, obwohl er ihn gemeldet hat —
  die Zahlen hier stammen aus eigener Messung. Merke: Bei Agenten prüfen, ob
  die Datei wirklich existiert, statt der Meldung zu glauben.

### Welche Prüfläufe sich als nächstes lohnen

Vorschläge, nicht beauftragt — aus dem, was bei der Arbeit auffiel:

- [ ] **Der Chat-Baum selbst.** Im Drei-Ansichten-Durchgang ausgenommen, im
      Nachprüf-Durchgang nur angerissen (Befund dort: super_admin fällt
      zwischen drei verschiedene "Leitung"-Definitionen, sieht den Mülleimer,
      bekommt vom Backend 403). Dort lagen schon zwei echte Sicherheitsfunde.
      **Der aussichtsreichste Kandidat.**
- [ ] **Offline-Schreibvorgänge.** Der Bericht vom 25.08. deckte die
      Lesepfade ab. Nicht geprüft: Was passiert, wenn ein Schreibvorgang aus
      der Warteschlange später vom Server abgelehnt wird (409, 403, geänderte
      Daten)? Erfährt jemand davon, oder verschwindet es still?
- [ ] **Push-Zustellung Ende zu Ende.** An vielen Stellen verdrahtet; ob jede
      Mitteilung ankommt und beim Antippen an der richtigen Stelle landet,
      wurde nie systematisch geprüft.
- [ ] **Zeitzonen und Datumsgrenzen.** Termine, Anmeldeschluss, Challenges mit
      Restzeit, Tageslosung, Wrapped-Jahresgrenze — überall Datumslogik,
      nirgends geprüft, ob sie an Tagesgrenzen und über die Sommerzeit stimmt.
- [ ] **Wrapped.** Kommt in mehreren Berichten am Rand vor (Slide-Inhalte nie
      geprüft, `has_wrapped` prüft nur die Freigabe statt der Snapshot-Existenz),
      war aber nie eigener Gegenstand.

---

## Nach 2.0.0

- [ ] **Das 3-MB-Bundle aufteilen** (697 kB gepackt, ein Monolith ohne
      Aufteilung nach Rollen). Groesster Hebel fuer den Kaltstart im Web,
      geschaetzt 697 -> etwa 400-450 kB je Rolle. BEWUSST NICHT vor 2.0.0:
      Der Umbau fasst die Wurzel des Routings an, trifft also jede Nutzerin,
      und nachladbare Teile brechen typischerweise erst im echten Betrieb bei
      schlechtem Netz. Der Nutzen ist einmalig (danach Cache, nativ ohnehin
      im Paket), die Fehler waeren dauerhaft.

- [x] **Biometrische Anmeldung** — ERLEDIGT 27.08.2026. Face ID, Touch ID und
      Android-Biometrie, Token biometrie-gebunden im Keychain/Keystore,
      Schalter in allen drei Profil-Ansichten ueber EINE geteilte Komponente.
      Wichtig fuer die Einordnung: Die App war auch vorher schon dauerhaft
      angemeldet — der Refresh-Token lag im Klartext in den Preferences. Die
      Funktion verlaengert die Sitzung also nicht, sie verlagert sie in den
      sicheren Speicher und stellt Face ID davor.
      NICHT auf echter Hardware getestet, nur mit gemocktem Plugin.
      **Einordnung (Simon 27.08.2026): Face ID verlaengert die Anmeldedauer
      NICHT — sie ist ein zusaetzlicher Schutz.** Die App war auch vorher
      dauerhaft angemeldet, beide Wege halten 90 Tage. Der Gewinn liegt darin,
      WO der Token liegt: biometrie-gebunden im Keychain/Keystore statt im
      Klartext. Simons Begruendung, es trotzdem zu behalten: Konfis sollen
      moeglichst lange angemeldet bleiben UND ihren Zugang vor dem Zugriff der
      Eltern schuetzen koennen. Die 90 Tage bleiben.
      Ausdrueckliches Abmelden loescht die gesicherte Sitzung weiterhin mit —
      bewusst, sonst waere Abmelden auf einem geteilten Geraet wirkungslos.

      **Warum es sich so anfuehlte, als melde die App staendig ab** (geprueft
      27.08.2026, nicht vermutet): Refresh-Tokens liegen in der Datenbank
      (Tabelle `refresh_tokens`). Beim Serverumzug am 26.08. wurde der
      Notbetriebs-Stand verworfen — wer sich in diesen zwei Stunden anmeldete,
      dessen Token war danach weg. Dazu macht ein Wechsel des `JWT_SECRET`
      alle Tokens auf einen Schlag ungueltig, und jede Passwortaenderung setzt
      `token_invalidated_at` (sperrt alle aelteren Tokens der Person, auch auf
      anderen Geraeten). Es war also die Folge von Umzug und Token-Umbauten,
      kein Fehler im Anmeldeverhalten.

- [ ] **Ionic 9 mit react-router-Umbau.** Kommt frueher oder spaeter zwingend;
      Entscheidung 27.08.2026: nicht vor 2.0.0, aber fest eingeplant.
      **Was uns NICHT trifft** (gegen den Code gemessen, nicht geschaetzt):
      `ion-picker-legacy`, `ion-img`, `IonNav`-Routing, `handleBehavior` —
      alle 0 Treffer. React 19, TypeScript 6.0.3 und Capacitor 8 erfuellen die
      neuen Mindestanforderungen bereits.
      **Was uns trifft:** react-router 5 -> 6. Ionic 9 verlangt
      `react-router >=6.4 <7` — NICHT Version 7 oder 8. Der Dependabot-PR #70
      (react-router 5 -> 8) fuehrt in eine von Ionic gar nicht unterstuetzte
      Version und gehoert geschlossen, nicht gemergt.
      Umfang, gezaehlt: 47x `component=`, 16x `render=`, 17x `<Redirect>`,
      63x `exact`, 6x `RouteComponentProps` — verteilt auf 11 Dateien.
      Alles mechanisch, aber es ist der Routing-Kern und trifft jede Nutzerin.
      Dazu 7x `autocorrect` (wird boolean).
      **Zusammen mit dem Bundle-Splitting machen** — beide fassen dasselbe
      Routing an, das doppelt zu tun waere Verschwendung.

- [x] **Rollenwechsel ohne Abmelden — VERWORFEN 27.08.2026.** Simons
      Entscheidung: "Die Idee mit dem Rollenwechsler verwerfen. Dann sind es
      halt drei Logins." Mit der biometrischen Anmeldung ist der eigentliche
      Schmerz (staendiges Passwort-Tippen) ohnehin weg.

---

## Erledigt am 25.08. (ausgerollt am selben Abend)

Alles Folgende ist am 25.08. abends als `90592c5` ausgerollt worden, mit
Sicherung vorher (`/opt/Konfi-Quest/dump/pre-90592c5-20260825-2151.sql`,
2,2 MB). Migration 128 ist angewandt (`schema_migrations`, 21:51 Uhr), die
View `event_booking_stats` existiert.

**Nachgemessen in Produktion:** Die Konfi-Fahrt (Termin 105, Organisation 1)
zeigt 19 Konfis, 4 Teamer:innen und 2 Abmeldungen — genau wie gefordert.
Gegenprobe in der Demo-Gemeinde über sechs Termine: Liste, Detail und die
View nennen überall dieselben Zahlen (2/5/7/7/12/7).

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

- [x] **Bildschirmfotos aus Organisation 4** — als Skript
      (`scripts/screenshots.mjs`, `e27413a5`), 19 Aufnahmen über alle drei
      Rollen. Aufruf `node scripts/screenshots.mjs`, wahlweise `--rolle`,
      `--geraet`, `--url`. Läuft gegen die Produktion mit den Demo-Konten.
- [x] **Store-Texte** — `docs/store-texte-2.0.0.md` (`e27413a5`): iOS 1828
      Zeichen, Android 467 von 500. Nachgezählt, keine Emojis, echte Umlaute.
- [x] **Handbuch mit Bildschirmfotos** — 16 Abbildungen in den drei
      Rollenkapiteln (`4a31627c`). Der Generator kann jetzt Bilder; fehlt eine
      Datei, bricht der Build ab (Gegenprobe: Exit 1 mit Dateinamen).
- [x] **Handbuch: QR-Einladung und QR-Check-in** beschrieben, Querverweise
      zwischen den Kapiteln ergänzt (`e6867f01`). Dabei zwei falsche Angaben
      gegen den Code korrigiert.
- [x] **iOS-Build 143** ausgelöst (`4d49a7c1`), CI und CodeQL vorher grün.
- [ ] **Git-Tag und GitHub-Release** (Tag ohne `v`-Präfix) — erst nach Simons
      Test, zusammen mit dem Datum im CHANGELOG.

### Nebenbefunde vom 25.08. abends — behoben (`bbf1e727`)

- [x] **Teamer:innen sehen den Termin-QR-Code nicht.** `QRDisplayModal` hing
      nur in `admin/views/EventDetailView.tsx`, obwohl das Backend den Abruf
      per `requireTeamer` freigibt (`generate-qr`, `attendance-count`). Sind
      bei einem Termin nur Teamer:innen vor Ort, kam niemand an den Code.
      Das Modal liegt jetzt unter `shared/` und wird in beiden Bäumen genutzt,
      statt es ein zweites Mal zu bauen.
      *Im Browser nachgemessen (demo.teamer, lokal): Knopf da, Modal öffnet,
      echtes QR-Bild, Zähler "0 / 9 eingecheckt", Drucken-Symbol vorhanden.*
      Der Handbuch-Absatz, der den Ist-Zustand beschrieb, ist damit überholt
      und wurde zurückgenommen.
- [x] **Challenges-Karte im Teamer-Dashboard sah anders aus** als "Was ist
      neu?" und der Mitmachen-Hinweis direkt daneben — sie war aus
      `app-list-item` plus Inline-Styles gebaut statt aus dem Banner-Look.
      Jetzt eine gemeinsame Komponente (`shared/ChallengesHinweisKarte`), die
      alle drei Bäume nutzen können. Genau daran läuft so etwas
      auseinander — jede Rolle hat einen eigenen Komponentenbaum.
      Sechs Tests, Gegenprobe rot.
- [x] **Dependabot-Meldung 123** (`uuid` < 11.1.1) — per npm-`overrides` auf
      11.1.1 gezwungen. GitHub führt die Meldung seit 25.08. als *fixed*,
      **0 offene Meldungen**. Das Paket hing nur an `@capacitor/cli` und damit
      am Bauwerkzeug, nicht an der App; die Meldung ist trotzdem weg statt
      begründet offen. Gegenprobe: `npm ls uuid` zeigt 11.1.1, `npx cap
      --version` und `npm run build` laufen unverändert.
      *Nebenbei belegt: Der ERESOLVE-Konflikt bei `npm install` (eslint)
      besteht vorher wie nachher — deshalb `--legacy-peer-deps`, wie die CI.*
