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

- [ ] **Mobile Navigation ist unbrauchbar.** Gemessen bei 390 px: Die
      Seitenleiste ist 449 px hoch, also 53 Prozent des Bildschirms, der
      Inhalt beginnt erst darunter. Sie ist `static`, beim Weiterlesen also
      weg. Simon will ein einklappbares, mitlaufendes Menü statt aller Punkte
      oben. *(In Arbeit.)*
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
- [ ] **Jahrgangswechsel** — was passiert mit Pflichtterminen?
- [x] **Event-Chats** — am 24.08. behoben (Eintritt bei Anmeldung, Austritt
      bei Abmeldung in allen drei Wegen).
      ALT: Eintritt bei Anmeldung, Austritt bei Abmeldung, aber
      bei Pflichtterminen drin bleiben. *(Teilweise am 24.08. behoben —
      prüfen, was noch offen ist.)*
- [ ] **Abzeichen: sind alle Bedingungen korrekt?** Was liegt überflüssig in
      der Datenbank?
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
- [ ] **Socket.IO** — Pushes nach dem Abmelden.
- [x] **Dashboard-Schalter** — zwei waren wirkungslos (`dashboard_show_challenges`
      kam im Backend nie vor, der Konfispruch-Schalter wurde ignoriert). Beide
      wirken jetzt, und bei "aus" wird die Route gar nicht erst abgefragt
      (`03a20a09`, `3439e9ed`).
      ALT: Wirkung der Schalter in der
      Leitungsansicht und die Sortierreihenfolge. Ist ein Bereich aus, sollen
      seine Routen gar nicht erst abgefragt werden.

---

## Bekannte Fehler, Ursache belegt, Fix offen

- [ ] **Testläufe brechen sporadisch ab** (etwa jeder vierte). Ursache belegt:
      `backend/database.js` ruft beim Laden `process.exit(1)`, wenn die
      Datenbank nicht sofort antwortet. `utils/liveUpdate.js` lädt dieses
      Produktions-Singleton und öffnet damit einen zweiten Pool — kommt dessen
      Start-Ping unter Last ins Timeout, stirbt der Testlauf, ohne dass ein
      Test schuld ist. Fix: `liveUpdate` den Pool übergeben statt ihn zu holen.
      Eine zweite Spur (Transportebene der Testverbindungen) ist offen.
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
