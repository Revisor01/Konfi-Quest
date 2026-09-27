# Audit „Wer bekommt was" — Mitteilungen, Live-Signale, Zähler und Listen je Rolle — 27.09.2026

## Umfang und Methode

**Regel, gegen die geprüft wurde** (Simons Entscheidungen vom 27.09.2026, am selben Tag ergänzt):

- **Org-Admin** sieht und bekommt alles seiner Gemeinde.
- **Admin und Teamer:in** sehen und bekommen nur, was einen Bezug zu ihren zugewiesenen Jahrgängen hat. Ausnahmen fürs ganze Team, ohne Jahrgang: (1) was ausdrücklich nur fürs Team ist — Termine „Nur Team", Challenges „Nur das Team"; (2) Termine ohne jeden Jahrgang; (3) Chat von Team zu Team (Team-Chat, Gruppen und Einzelchats unter Teamer:innen, Admins, Org-Admins).
- **Konfi** sieht und bekommt nur den eigenen Jahrgang und die eigenen Vorgänge.
- **Mitteilung = Sichtbarkeit:** Eine Mitteilung bekommt genau, wer den Vorgang in seiner Liste sieht und bearbeiten darf. Rote Zahlen (Reiter, App-Symbol, Gemeinde-Umschalter, Postfach) zählen genau das, was die Person sehen kann.
- Rolle und Jahrgänge gelten je Gemeinde (`users.organization_id`/`role_id` für die Stamm-Gemeinde, `user_organizations` für weitere). Super-Admin bekommt keine Gemeinde-Mitteilungen, die nicht für ihn sind.

**Geprüft (gelesen, vollständig):** `backend/services/pushService.js` (alle 41 `send…`-Methoden, Empfängerauswahl, Postfach-Schreiben, App-Symbol-Rechnung), alle Aufrufer (`grep -rnE "PushService\.[a-zA-Z]+\("` über `routes`, `services`, `utils`: 68 Aufrufstellen), `utils/postfachArten.js`, die sechs direkten `INSERT INTO notifications` (`konfi.js`, `teamer.js`, `activities.js`, `badges.js`), `utils/postfachAufraeumen.js`, `services/emailService.js` mit allen Aufrufern, `services/backgroundService.js` (Zähler-Lauf, Erinnerungen, Anmeldestart, Challenge-Start, Verbuchen-Erinnerung, Lizenz- und Löschwarnung, Rückblick-Cron, Auto-Löschung), `utils/liveUpdate.js` mit allen 135 Aufrufen, `server.js` (Socket-Anmeldung, `joinRoom`), die direkten `io.to(…)`-Sendungen in `chat.js`, `routes/notifications.js` (alle Felder von `badge-counts`, `badge-counts/je-organisation`, Postfach), `utils/appIconBadge.js`, `utils/challengeLeitungSicht.js`, `utils/challengeNeuigkeiten.js`, `utils/orgMitglieder.js`, `utils/jahrgangsZugriff.js`, `utils/jahrgangChat.js`, `utils/teamChat.js`, `utils/eventChat.js`, `utils/chatRoomAccess.js`, `middleware/rbac.js`, die Listen-Routen der Leitung und des Teams (Anträge, Konfis, Termine, Termin-Detail, Jahrgänge, Challenges, Chat-Räume, Material, Postfach), die Konfi-Terminliste, `routes/einladungen.js`, Beförderung (`konfi-management.js`), Mitgliedschaftsende (`users.js`, `organizations.js`), Passwort-Routen (`auth.js`). Im Frontend nur `contexts/BadgeContext.tsx` (App-Symbol) und die Aufrufer von `je-organisation`. Handbuch `05-rollen`, `35-passwoerter`, `70-termine`, `80-challenges`, `90-chat` an den Stellen, die Empfänger beschreiben.

**Ausgeführt:** 16 temporäre Vitest-Tests (A1–A16) in `backend/tests/audit-tmp/` gegen einen eigenen Cluster (Port 5443, Produktionsschema + offene Migrationen, Seed aus `helpers/seed.js`), Firebase und Mailversand gemockt wie in `tests/services/pushEmpfaengerMultiOrg.test.js`; vor dem Commit gelöscht. Zusätzlich zum Seed: zweiter Jahrgang J3 in Gemeinde 1, `adminB` (nur J3), `adminOhneJg`, `teamerB` (nur J3), `konfiOhneJg`, `admin1` auf J1, Push-Token für alle Konten. Bestehende Suiten zur Gegenkontrolle: `pushEmpfaengerMultiOrg`, `pushBadgeMultiOrg`, `postfachSchreiben`, `feedPushSichtbarkeit`, `orgMitglieder`, `chatRoomAccess`, `appIconBadgeParitaet`, `chatMembershipSync`, `challengeNeuigkeitenLeitung`, `notifications` — 162/162 grün.

**Früherer Bericht:** `docs/audit/2026-09-26/backend-fachlogik-chat-challenges-rueckblick.md` wurde gegen den Code nachgeprüft; wo ein Punkt hier wieder auftaucht, steht es beim Befund.

## Zusammenfassung

Die Empfänger sind gründlich auf beide Zugehörigkeitsquellen umgestellt (Rolle je Gemeinde, gesperrte Konten fallen heraus, Super-Admin bekommt nirgends etwas), und die Challenges folgen seit heute einer gemeinsamen Regel für Liste, Zähler und Mitteilung. **Die Jahrgangsbindung der Admins ist dagegen fast nur in den Listen und Zählern angekommen, nicht in den Mitteilungen:** Jede Leitungs-Meldung außer Registrierung und Challenge-Beitrag geht über `ladeLeitungDerOrganisation(db, org)` ohne Jahrgang an alle Admins der Gemeinde — auch an Admins ohne Jahrgang (die Lizenzmail über eine eigene Abfrage, BF-09). Auf Konfi-Seite geht „Neues Event!" an alle Konfis der Gemeinde, egal für welchen Jahrgang der Termin ist.

**22 Befunde: 9 HOCH, 5 MITTEL, 8 NIEDRIG.**

Die HOCH-Befunde:

1. **BF-01** Konfi-Abmeldungen samt Grund, Pflicht-Opt-out/-in, Teamer-Zu-/Absagen zu Jahrgangsterminen und die Jahrgangs-Löschwarnung (Push, Postfach, Mail) gehen an alle Admins der Gemeinde.
2. **BF-02** Konfi-Anträge (Push und Postfach) gehen an alle Admins — *in Arbeit (eigenes Paket)*.
3. **BF-03** Neue Registrierung: Org-Admins ohne Zuweisung bekommen nichts, sobald ein Admin dem Jahrgang zugewiesen ist; ohne Zuweisung geht sie an alle Admins.
4. **BF-04** „Neues Event!" geht an alle Konfis der Gemeinde — auch für Termine anderer Jahrgänge und ohne Jahrgang, die sie gar nicht sehen.
5. **BF-05** Jeder Admin kann jeden gemeinschaftlichen Chat-Raum der Gemeinde lesen, beschreiben und live mithören — fremde Jahrgangs-Chats, Termin-Chats, Gruppen mit fremden Konfis.
6. **BF-06** Wird ein Termin gelöscht (nicht abgesagt), erfahren es nur die Konfis — gebuchte Teamer:innen nie, bei „Nur Team"-Terminen also niemand.
7. **BF-07** Beim Start einer Challenge „Nur das Team" bekommt niemand eine Mitteilung, bei „Jahrgang und Team" nur die Konfis; einen Zähler für die neue Challenge hat das Team auch nicht.
8. **BF-08** Beendet der Super-Admin eine Mitgliedschaft, bleibt die Person in Gruppen- und Einzelchats der Gemeinde und bekommt deren Nachrichten weiter.
9. **BF-09** Die Lizenz-Erinnerung erreicht nur die Stamm-Leitung (Zusatz-Org-Admins nie) — dafür auch jahrgangsgebundene Admins.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Vor dem nächsten Release BF-01 bis BF-04 schließen — sie tragen Namen und Gründe (Abmeldegrund „krank", Antrag) an Personen, die den Vorgang nicht sehen dürfen, und haben dieselbe Ursache (Empfängerliste ohne Jahrgänge des Vorgangs). BF-05 und BF-08 erst nach Antwort auf F-01 bzw. zusammen mit dem Mitgliedschafts-Fix. Die vorhandenen Tests `pushEmpfaengerMultiOrg.test.js:102, 108, 114, 150` schreiben das alte Verhalten fest (Admin ohne Jahrgang bekommt Opt-out, Antrag, Verbuchen, Löschwarnung) und müssen mit dem Fix umgestellt werden.

## Matrix

Kürzel: **selbst** = nur die betroffene Person · **Jg** = nur mit Zuweisung auf einen Jahrgang des Vorgangs · **Gem.** = alle dieser Rolle in der Gemeinde (beide Quellen, Rolle je Gemeinde) · **—** = nie · ✔ entspricht der Regel · ✘ BF-xx widerspricht ihr. Spalte Admin = Rolle `admin` (jahrgangsgebunden), Org-Admin = `org_admin` (auch mit Super-Admin-Merkmal), Super-Admin = Rolle `super_admin`.

### Mitteilungen an die Leitung

Mitteilung = Push; jede Art aus `postfachArten.js` bzw. mit eigenem `INSERT` steht zusätzlich im Postfach und zählt am App-Symbol.

| Ereignis (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| Neuer Konfi-Antrag — Push `pushService.js:1287`, Postfach `konfi.js:728-754` | selbst: „Antrag eingereicht" ✔ | — ✔ | Gem. ✘ BF-02 | Gem. ✔ | — ✔ |
| Neuer Teamer-Antrag — `teamer.js:1314-1343` | — ✔ | selbst ✔ | Gem. ✔ (F-08) | Gem. ✔ | — ✔ |
| Konfi-Abmeldung, freiwilliger Termin — `pushService.js:1531`, `konfi.js:1833` | selbst ✔ | — ✔ | Gem. ✘ BF-01 | Gem. ✔ | — ✔ |
| Pflicht-Opt-out / Opt-in — `pushService.js:2443/2476`, `konfi.js:1964/2046` | — ✔ | — ✔ | Gem. ✘ BF-01 | Gem. ✔ | — ✔ |
| Teamer-Zu-/Absage — `pushService.js:2544/2572`, `teamer.js:1220/1225`, `buchung.js:79/291` | — ✔ | — ✔ | Gem.: ✔ bei „Nur Team"/ohne Jahrgang, ✘ BF-01 bei Jahrgangsterminen | Gem. ✔ | — ✔ |
| Neue Registrierung — `pushService.js:2406-2434`, `auth.js:1101` | — ✔ | — (F-02) | Jg ✔, ohne Zuweisung im Jahrgang: Gem. ✘ BF-03 | nur mit Zuweisung oder im Rückfall ✘ BF-03 | — ✔ |
| Neuer Challenge-Beitrag — `pushService.js:2231-2295`, `challenges.js:897` | — (eigener ausgenommen) ✔ | „Nur Team": Gem., sonst Jg ✔ | wie Teamer:in ✔ | Gem. ✔ | — ✔ |
| „Events warten auf Verbuchung", 09:00 — `backgroundService.js:984-1026`, `pushService.js:2339` | — ✔ | — ✔ | Gem., Zahl der ganzen Gemeinde ✘ BF-10 | Gem. ✔ | — ✔ |
| Jahrgang wird gelöscht (Push, Postfach, Mail) — `backgroundService.js:1533-1566`, `pushService.js:2375` | — ✔ | — ✔ | Gem. ✘ BF-01 | Gem. ✔ | — ✔ |
| Lizenz läuft ab (Mail) — `backgroundService.js:1388-1450` | — ✔ | — ✔ | nur Stamm ✘ BF-09 | nur Stamm ✘ BF-09 | — ✔ |

### Mitteilungen an Konfis und Team

| Ereignis (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| Antrag entschieden — `activities.js:703/726` | selbst ✔ | selbst ✔ | — ✔ | — ✔ | — ✔ |
| Punkte/Bonus/Level — `activities.js:864`, `konfi-management.js:1224-1231`, `pushService.js:1569` | selbst ✔ | — ✔ | — ✔ | — ✔ | — ✔ |
| Abzeichen — `badges.js:739/747` | selbst ✔ | selbst ✔ | — ✔ | — ✔ | — ✔ |
| Anmeldestart „Neues Event!" — `backgroundService.js:609-662`, `pushService.js:1962-2016` | alle der Gemeinde ✘ BF-04 | — ✔ | — ✔ | — ✔ | — ✔ |
| Neues Pflicht-Event — `verwaltung.js:298-313` | Jahrgänge des Termins ✔ | — ✔ | — ✔ | — ✔ | — ✔ |
| Angemeldet/Warteliste/Nachgerückt — `konfi.js:1638`, `buchung.js:88`, `teilnehmer.js:274/278`, `nachrueckMeldung.js:44/46` | selbst ✔ | selbst ✔ | selbst ✔ | selbst ✔ | — ✔ |
| Termin geändert — `verwaltung.js:758-775` | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | — ✔ |
| Termin abgesagt / findet doch statt — `verwaltung.js:1188-1243`, `:1571` | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | — ✔ |
| Termin gelöscht — `verwaltung.js:872-879, 1012-1015` | Gebuchte ✔ | nie ✘ BF-06 | nie ✘ BF-06 | nie ✘ BF-06 | — ✔ |
| Von der Leitung ausgetragen / auf Warteliste gesetzt — `teilnehmer.js:446, 658` | nichts ✘ BF-14 | nichts ✘ BF-14 | — | — | — ✔ |
| Anwesenheit verbucht — `anwesenheit.js:161, 628-653`, `checkin.js:247-253` | selbst ✔ | — ✔ | — ✔ | — ✔ | — ✔ |
| Erinnerung 24 h / 1 h — `backgroundService.js:853-932` | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | Gebuchte ✔ | — ✔ |
| Challenge gestartet — `backgroundService.js:712-734`, `pushService.js:2032` | Jahrgänge ✔ | nie ✘ BF-07 | nie ✘ BF-07 | nie ✘ BF-07 | — ✔ |
| Neuer Beitrag in der Galerie — `pushService.js:2107`, `challenges.js:924/1867` | Jahrgänge ohne Einreicher ✔ | über Beitrags-Meldung ✔ | ebenso ✔ | ebenso ✔ | — ✔ |
| Stempel / Beitrag ausgeblendet — `challenges.js:948/1819/1887` | selbst ✔ | selbst ✔ | selbst ✔ | selbst ✔ | — ✔ |
| Zertifikat — `teamer.js:635` | — ✔ | selbst ✔ | — ✔ | — ✔ | — ✔ |
| Rückblick freigegeben — `wrapped.js:2466/2673/3342` | Jahrgang ✔ | Gem. (Team-Rückblick) ✔ | — ✔ | — ✔ | — ✔ |
| Einladung in weitere Gemeinde (Push, Postfach, Mail) — `einladungen.js:178-190` | — ✔ | selbst ✔ | selbst ✔ | selbst; Antwort: nichts (BF-21) | — ✔ |
| Beförderung zur Teamer:in — `konfi-management.js:1519-1700` | — | bleibt im alten Jahrgangs-Chat ✘ BF-19 | — | — | — ✔ |
| Passwort vergessen / geändert — `auth.js:751-800`, `emailService.js:193` | Mail an Adresse ✘ BF-20 | ebenso | ebenso | ebenso | ebenso |

### Chat (Teilnahme = Push und Ungelesen-Zahl)

| Raum / Weg (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| Jahrgangs-Chat — `jahrgangChat.js:60-115` | eigener Jahrgang ✔ | Jg (can_view) ✔ | Jg (can_view) ✔ | alle ✔ | — ✔ |
| Team-Chat — `teamChat.js:50-72` | — ✔ | Gem. ✔ (Ausnahme 3) | Gem. ✔ | Gem. ✔ | — ✔ |
| Termin-Chat — `verwaltung.js:1033-1100`, `eventChat.js:90-104`, `bookingUtils.js:950/1055` | Gebuchte inkl. Warteliste ✔ (Handbuch anders, BF-17) | ebenso | Ersteller:in/Gebuchte | ebenso | — ✔ |
| Gruppen / Einzelchats (Anlegen) — `chat.js:363-383, 449-520, 622-700` | nur Einzelchat zu Team des Jahrgangs und Org-Admins ✔ | Konfis nur Jg ✔ | Konfis nur Jg ✔ | alle ✔ | — ✔ |
| Öffnen ohne Teilnahme (lesen, schreiben, Export, `joinRoom`) — `chat.js:401-416`, `chatRoomAccess.js:55` | — ✔ | — ✔ | alle gemeinschaftlichen Räume ✘ BF-05 | alle ✔ | — ✔ |
| Mitgliedschaft beendet, Org-Admin-Weg — `users.js:660-720` | — | Plätze weg ✔ | Plätze weg ✔ | Plätze weg ✔ | — |
| Mitgliedschaft beendet, Super-Admin-Weg — `organizations.js:1225-1285` | — | bleibt in Gruppen/Einzelchats ✘ BF-08 | ebenso ✘ BF-08 | ebenso ✘ BF-08 | — |

### Live-Signale (Socket.IO)

| Weg (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| `liveUpdate.sendToOrgAdmins` (66 Aufrufe, `liveUpdate.js:107-158`) | — ✔ | Gem. (Kennungen) ✘ BF-15 | Gem. ✘ BF-15 | Gem. ✔ | — ✔ |
| `sendToOrgKonfis` / `sendToOrg` (Termine, Abzeichen; `liveUpdate.js:169-217`) | Gem. ✘ BF-15 | wie oben | wie oben | Gem. ✔ | — ✔ |
| `sendToJahrgang` (Challenges) | Jahrgang ✔ | — | — | — | — ✔ |
| `sendToUser` / `sendToUserByRole` | selbst ✔ | selbst (Stamm-Rolle, BF-15) | selbst | selbst | — ✔ |
| Chat `newMessage`, `roomsChanged`, Umfragen — `chat.js:98-145, 222, 246` | Teilnehmende + offener Raum ✔ | ebenso ✔ | ebenso, dazu BF-05 | ebenso ✔ | — ✔ |

### Zähler

| Zähler (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| `badge-counts.chat` — `notifications.js:49-70` | Teilnahme, aktive Gemeinde ✔ | ebenso ✔ | ebenso ✔ | ebenso ✔ | — ✔ |
| `pendingRequests` — `notifications.js:175-194`, `appIconBadge.js:121-142` | 0 ✔ | 0 ✔ | Teamer-Anträge + Jg ✔ | Gem. ✔ | — ✔ |
| `pendingEvents` — `notifications.js:207-237`, `appIconBadge.js:149-176` | 0 ✔ | 0 ✔ | + „Team gesucht" fremder Jahrgänge ✘ BF-11 | Gem. ✔ | — ✔ |
| `pendingChallenges` / `challengeApprovals` — `notifications.js:109-143` | 0 ✔ | Regel ✔ | Regel ✔ | Gem. ✔ | — ✔ |
| `challengeUpdates` — `challengeNeuigkeiten.js` | Jahrgang, inkl. neue Challenge ✔ | nur Beiträge, keine neue Challenge ✘ BF-07 | ebenso ✘ BF-07 | ebenso ✘ BF-07 | — ✔ |
| `newBadges` | selbst ✔ | selbst ✔ | 0 ✔ | 0 ✔ | — ✔ |
| `postfach.ungelesen` — `notifications.js:274-277` | alle Gemeinden des Kontos ✔ | ebenso | ebenso, erbt BF-01/02/10 | ebenso | — ✔ |
| Gemeinde-Umschalter `je-organisation` — `notifications.js:373-400` | ✔ | Rolle je Gemeinde ✔ | ✔ | ✔ | — ✔ |
| App-Symbol aus Push und stillem Lauf — `pushService.js:477-562, 599-703`, `backgroundService.js:226-352` | ✔ | Stamm-Rolle in jeder Gemeinde ✘ BF-12 | ebenso ✘ BF-12 | ebenso ✘ BF-12 | — ✔ |
| App-Symbol aus der offenen App — `BadgeContext.tsx:156-165, 466-478` | ✔ | nur aktive Gemeinde ✘ BF-12 | ebenso ✘ BF-12 | ebenso ✘ BF-12 | — ✔ |

### Listen der Leitung und des Teams

| Liste (Fundstelle) | Konfi | Teamer:in | Admin | Org-Admin | Super-Admin |
|---|---|---|---|---|---|
| Anträge — `activities.js:335-410` | eigene (`konfi.js:604`) ✔ | eigene ✔ | Teamer-Anträge + Jg ✔ | Gem. ✔ | — ✔ |
| Konfis / neue Registrierungen — `konfi-management.js:64-118` | — ✔ | Jg ✔ | Jg ✔ | Gem. ✔ | — ✔ |
| Termine, Verbuchen — `events/lesen.js:249-289` | eigener Jahrgang (`konfi.js:1126-1330`) ✔ | Jg + „Nur Team" + ohne Jahrgang ✔ | ebenso ✔ | Gem. ✔ | — ✔ |
| Termin-Detail samt Abmeldungen — `events/lesen.js:529-660` | — | Jg ✔ | Jg ✔ | Gem. ✔ | — ✔ |
| Jahrgänge — `jahrgaenge.js:61-90` | — | Jg ✔ | Jg ✔ | Gem. ✔ | — ✔ |
| Challenges (Leitung, Teilnahme) — `challenges.js:436-485, 1214` | Jahrgang ✔ | Regel ✔ | Regel ✔ | Gem. ✔ | — ✔ |
| Chat-Räume — `chat.js:832-985` | Teilnahme ✔ | Teilnahme ✔ | Teilnahme ✔ (Öffnen: BF-05) | Teilnahme ✔ | — ✔ |
| Material — `material.js:54-68` | — ✔ | Jg + global ✔ | Jg + global ✔ | Gem. ✔ | — ✔ |
| Postfach — `notifications.js:457-511` | eigene ✔ | eigene ✔ | eigene; bleibt nach Konto-Löschung/Mitgliedschaftsende ✘ BF-13 | ebenso ✘ BF-13 | — ✔ |

## Befunde

### BF-01: Leitungs-Meldungen zu Jahrgangsvorgängen gehen an alle Admins der Gemeinde
- **Schwere:** HOCH
- **Status:** behoben 27.09.2026 — Event-Meldungen (Konfi-Abmeldung, Opt-out/-in, Teamer-Zu-/Absage über Zusage-Route und `/events/:id/book`) über `ladeLeitungZumTermin` (`backend/utils/terminLeitungSicht.js`): Org-Admins immer, Admins mit `can_view` auf einen Jahrgang des Events, bei „Nur Team" und ohne Jahrgang alle Admins, Teamer:innen nie, handelnde Person nie (F-10). Dieselbe Regel filtert `GET /events` (`routes/events/lesen.js`). Löschwarnung (Push, Postfach, Mail) über `ladeLeitungZumJahrgang(…, { schreibrecht: true })` (`backend/utils/jahrgangLeitungSicht.js`): Org-Admins und Admins mit `can_edit` (F-14). Die Push-Methoden heißen `…ToLeadership` und nehmen die Empfänger von der Aufrufstelle; ohne Liste geht nichts raus. Tests `tests/routes/terminLeitungEmpfaenger.test.js`, `tests/services/jahrgangLeitungEmpfaenger.test.js`.
- **Fundstelle:** `backend/services/pushService.js:1535` (Konfi-Abmeldung), `:2445` (Opt-out), `:2478` (Opt-in), `:1266` (`sendToOrgAdmins` für Teamer-Zu-/Absage, `:2546/2586`), `:2377` (Löschwarnung) — alle `ladeLeitungDerOrganisation(db, organizationId)` ohne `jahrgangIds`; Mail der Löschwarnung `backgroundService.js:1533-1541`
- **Kennzeichnung:** reproduziert (A2, A5, A7)
- **Beschreibung:** `ladeLeitungDerOrganisation` kann seit dem 25.09. nach Jahrgängen filtern (`orgMitglieder.js:45-54`), benutzt wird das nur bei der Registrierung und beim Challenge-Beitrag. Alle anderen Leitungs-Meldungen gehen an jede Person mit Rolle `admin` oder `org_admin` — auch an Admins fremder Jahrgänge und an Admins ohne Jahrgang, die den Termin bzw. Jahrgang weder in der Liste noch im Detail öffnen dürfen. Der Text trägt Namen und Grund. Das Handbuch beschreibt den Ist-Stand (`05-rollen.md:255-266`: „Meldungen an die Leitung … aus jeder Gemeinde, in der die Person Admin oder Org-Admin ist").
- **Auswirkung aus Nutzersicht:** Ein Admin, der nur Jahrgang B begleitet, liest auf dem Sperrbildschirm „Test Konfi 1 hat sich von 'Konfi-Unterricht' abgemeldet. Grund: krank, Fieber seit gestern" über ein Kind aus Jahrgang A — und kann den Termin danach nicht öffnen (403). Dasselbe für Teamer-Absagen mit Grund und die Löschwarnung für einen Jahrgang, den er nicht sieht.
- **Beleg:** `A2 Opt-out 200 -> Push an ["admin1","adminB(J3)","adminOhneJg","orgAdmin1","orgAdminSuper"] | Text bei adminB: "Test Konfi 1 hat sich von 'Konfi-Unterricht' abgemeldet. Grund: krank, Fieber seit gestern"`, `A2 Opt-in … adminB GET /events/2 -> 403`, `A2 Abmeldung 200 -> Push an [dieselben fünf]`; `A5 Zusage 200 -> Push an [dieselben fünf] | Absage 200 -> [dieselben fünf] | adminB GET /events/70 -> 403`; `A7 Push jahrgang_deletion_warning -> [dieselben fünf] | Mails an [admin1, admin_b, admin_ohne, orgadmin1, orgadminsuper] | adminB sieht Jahrgaenge [303]`.
- **Empfehlung:** Eine Empfängerregel „Leitung des Vorgangs" neben `challengeLeitungSicht.js`: Org-Admins immer, Admins nur mit `can_view`-Zuweisung auf einen Jahrgang des Termins; bei „Nur Team" und Terminen ohne Jahrgang alle Admins. Die Methoden bekommen die Termin- bzw. Jahrgangs-Kennung (liegt an jeder Aufrufstelle vor). Löschwarnung: Org-Admins + Admins des Jahrgangs (F-14). Tests: verbotener Fall (Admin fremder Jahrgang, Admin ohne Jahrgang) und erlaubter (Admin des Jahrgangs, Org-Admin, „Nur Team"-Termin → alle Admins); `pushEmpfaengerMultiOrg.test.js:102/114/150` anpassen. Handbuch `05-rollen.md:255-266` nachziehen.

### BF-02: Konfi-Anträge gehen per Push und Postfach an alle Admins — in Arbeit
- **Schwere:** HOCH · **Status:** in Arbeit (eigenes Paket, 27.09.2026)
- **Fundstelle:** `backend/routes/konfi.js:728-754` (Postfach-INSERT an `ladeLeitungDerOrganisation`), `:758` → `pushService.js:1287-1313`
- **Kennzeichnung:** reproduziert (A1)
- **Beschreibung:** Liste und Zähler sind seit 31.08. gebunden (`activities.js:352-381`, `notifications.js:184-194`), Push und Postfach nicht. Der Postfach-Eintrag trägt `konfi_name`, Aktivität und Punkte. Die Zahl am Postfach und am App-Symbol steigt, die Antragsliste bleibt leer.
- **Auswirkung aus Nutzersicht:** Admin B sieht „Neuer Antrag eingegangen — Test Konfi 1 …" in Glocke und Push, tippt darauf und findet eine leere Antragsliste.
- **Beleg:** `A1 POST -> 201 | Push new_activity_request an ["admin1","adminB(J3)","adminOhneJg","orgAdmin1","orgAdminSuper"] | Postfach an [dieselben] | adminB Liste: 0 Antraege | adminB badge-counts pendingRequests 0 postfach.ungelesen 1`.
- **Empfehlung:** wie BF-01 mit dem Jahrgang der Konfi; Konfi ohne Jahrgang → nur Org-Admins. Teamer-Anträge bleiben org-weit (F-08).

### BF-03: Neue Registrierung erreicht Org-Admins nicht — und ohne Jahrgangs-Admin alle Admins
- **Schwere:** HOCH
- **Status:** behoben 27.09.2026 — `routes/auth.js` holt die Empfänger über `ladeLeitungZumJahrgang` (`backend/utils/jahrgangLeitungSicht.js`): Org-Admins immer (auch ohne Zuweisung), Admins mit `can_view` auf den Jahrgang, Teamer:innen nie (F-02), kein Rückfall an alle Admins (F-03). `sendNewKonfiRegistrationToLeadership` nimmt die Liste von der Aufrufstelle. Handbuch `35-passwoerter.md` und `45-jahrgaenge.md` („Nachsehen, wer Meldungen zu einem Jahrgang bekommt"). Test `tests/services/jahrgangLeitungEmpfaenger.test.js`, Parität mit der Konfi-Liste.
- **Fundstelle:** `backend/services/pushService.js:2410-2415`; Handbuch `35-passwoerter.md:342`
- **Kennzeichnung:** reproduziert (A3)
- **Beschreibung:** `ladeLeitungDerOrganisation(db, org, { jahrgangIds: [j] })` verlangt eine Zuweisung auch für `org_admin`; Org-Admins tragen in der Regel keine (sie sehen ohne Zuweisung alles). Sobald ein Admin dem Jahrgang zugewiesen ist, fällt der Org-Admin heraus. Ist niemand zugewiesen, geht der Rückfall an die ganze Leitung, also auch an Admins fremder Jahrgänge und ohne Jahrgang. Der Jahrgangsfilter prüft außerdem `can_view` nicht (BF-16).
- **Auswirkung aus Nutzersicht:** Die Gemeindeleitung erfährt nicht, dass sich jemand registriert hat, obwohl die Konfi sofort in ihrer Liste steht; im anderen Fall bekommt ein fremder Admin Name und Jahrgang einer Konfi.
- **Beleg:** `A3 Registrierung J1 (admin1 zugewiesen) 200 -> Push an ["admin1"] | Registrierung J4 (niemand zugewiesen) 200 -> Push an ["admin1","adminB(J3)","adminOhneJg","orgAdmin1","orgAdminSuper"] | orgAdmin1 Konfi-Liste enthaelt Neue Konfi: true`.
- **Empfehlung:** Empfänger = alle Org-Admins ∪ Admins mit `can_view` auf den Jahrgang, kein Rückfall (F-03). Test: Org-Admin ohne Zuweisung bekommt sie, Admin fremder Jahrgang nicht.

### BF-04: „Neues Event!" geht an alle Konfis der Gemeinde
- **Schwere:** HOCH
- **Fundstelle:** `backend/services/pushService.js:1979-1985` (Empfänger: jede Konfi der Gemeinde), Aufruf `backgroundService.js:654`
- **Kennzeichnung:** reproduziert (A4)
- **Beschreibung:** Die Konfi-Terminliste zeigt nur Termine des eigenen Jahrgangs (`konfi.js:1235` `INNER JOIN event_jahrgang_assignments`, `:1319` `eja.jahrgang_id = $3`); Termine ohne Jahrgang und fremder Jahrgänge fehlen, eine Konfi ohne Jahrgang sieht gar keine. Der Anmeldestart-Push fragt dagegen nur die Gemeinde. Der Text lautet „… — Melde dich jetzt an!".
- **Auswirkung aus Nutzersicht:** Jede Konfi bekommt jede Woche Einladungen zu Terminen anderer Jahrgänge und zu Team-internen Terminen ohne Jahrgang, tippt darauf und findet nichts. Bei mehreren Jahrgängen je Gemeinde ist das der häufigste Push überhaupt.
- **Beleg:** `A4 Termin 80 (nur J3) -> Push an ["konfi1","konfi2","konfiOhneJg"] | Termin 81 (ohne Jahrgang) -> Push an ["konfi1","konfi2","konfiOhneJg"] | konfi1 Liste enthaelt 80/81: false false | konfiOhneJg Liste: 0`.
- **Empfehlung:** Empfänger über `event_jahrgang_assignments` wie `sendMandatoryEventCreated` (`verwaltung.js:298-313`); Termine ohne Jahrgang ohne Konfi-Push (F-05). Test mit zwei Jahrgängen und einer Konfi ohne Jahrgang; `pushService.test.js:245-283` anpassen.
- **Status:** behoben 27.09.2026 — Regel-Stelle `backend/utils/konfiTerminSicht.js` (`konfiSiehtTerminSql`, `ladeKonfisDieTerminSehen`); Konfi-Terminliste (`konfi.js`) und „Neues Event!" (`pushService.sendNewEventToOrgKonfis`) lesen sie beide. Empfänger: Konfis der Jahrgänge des Termins, nie „Nur Team"; Termine ohne Jahrgang und Konfis ohne Jahrgang: niemand (die Liste zeigt sie nicht, F-05 wie empfohlen). Erinnerungen 24 h/1 h gehen weiter nur an eigene Buchungen — nicht derselbe Fehler. Tests `tests/services/neuesEventEmpfaenger.test.js` (9, inkl. Parität mit `GET /api/konfi/events`).

### BF-05: Admins öffnen jeden gemeinschaftlichen Chat-Raum der Gemeinde
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/chat.js:401-416` (`darfRaumOeffnen`: `user.type === 'admin'` genügt), `backend/utils/chatRoomAccess.js:55` (Socket-`joinRoom`); benutzt von Nachrichten lesen/schreiben (`chat.js:1083, 1247`), Export (`:1465`), Teilnehmerliste (`:1586`), Umfragen, Löschen (`:2341`), Reaktionen; Handbuch `90-chat.md:153-158`
- **Kennzeichnung:** reproduziert (A10)
- **Beschreibung:** `type 'admin'` umfasst `admin` und `org_admin`. Ein Admin ohne Zuweisung auf Jahrgang A liest dessen Jahrgangs-Chat, schreibt hinein (Push an alle Konfis dort), exportiert ihn und tritt dem Socket-Raum bei (bekommt jede neue Nachricht live). Gleiches für Termin-Chats fremder Jahrgänge und Gruppen mit Konfis fremder Jahrgänge. In der eigenen Raumliste erscheinen die Räume nicht; der Zugriff geht über die Raum-Kennung (fortlaufende Zahl) per Schnittstelle oder Socket. Das Handbuch beschreibt den Ist-Stand, widerspricht aber der Regel.
- **Auswirkung aus Nutzersicht:** Wer die Kennung eines Raums kennt oder durchprobiert, liest als Admin die Gespräche von Konfis, für die er nicht zuständig ist — die Jahrgangsgrenze des Anschreibens (`chat.js:363-383`) wird beim Lesen nicht gezogen.
- **Beleg:** `A10 adminB GET /chat/rooms/1/messages -> 200 ["Ich hab heute Stress zu Hause"] | teamerB -> 403 | Socket joinRoom adminB {"ok":true} adminOhneJg {"ok":true} | adminB Raumliste enthaelt 1: false`; `A10 adminB Gruppe mit J1-Konfi -> 200`.
- **Empfehlung:** Nach Antwort auf F-01: Ohne Teilnahme nur `org_admin` (und Super-Admin-Merkmal) org-weit; `admin` nur Jahrgangs-Chats seiner Jahrgänge, Termin-Chats von Terminen, die `darfTermin` erlaubt, und reine Team-Räume. Dieselbe Regel in `chatRoomAccess.js`. Handbuch `90-chat.md:153-158` anpassen. Test: Admin fremder Jahrgang → 403 und Socket abgelehnt; Admin des Jahrgangs, Org-Admin, Team-Gruppe → erlaubt.
- **Status:** behoben 27.09.2026 — F-01 entschieden (Regel in CLAUDE.md „Wer sieht und bekommt was"). Eine Regel-Stelle `backend/utils/chatRoomAccess.js` (`darfRaumBetreten`): Teilnahme genügt; ohne Teilnahme `org_admin`/Super-Admin-Merkmal gemeindeweit, `admin` nur Jahrgangs-Chat mit `can_view`-Zuweisung, Termin-Chat über `darfTermin` (dieselbe Regel wie `GET /events`) und Räume ohne Konfi; Einzelchats nie. `chat.js` `darfRaumOeffnen` ruft sie, der Socket über `socketRaumEreignisse` (joinRoom, typing, stopTyping; `server.js`). Zusätzlich an die Regel gehängt, weil sie sonst daran vorbeiführten: `POST/DELETE /rooms/:id/participants` (ein Admin trug sich selbst in jede Gruppe ein), `DELETE /rooms/:id` (jeder Raum der Gemeinde, auch fremde Direktchats), `DELETE /rooms/:id/messages` und `GET /files/:filename` (eigene Kopie: Teilnahme ohne `user_type`, dafür kein Zugang für den Org-Admin ohne Teilnahme). Reaktion setzen bleibt strenger (nur Teilnehmende). Raumliste unverändert teilnahmebasiert, Antwortform unverändert. Test `tests/routes/chatZugangNachJahrgang.test.js` (13: REST und echter Socket-joinRoom, verboten und erlaubt, Raumliste bietet nur Öffenbares an, Termin-Chat genau dann offen, wenn der Termin in `GET /events` steht); Gegenprobe mit wieder eingesetztem Admin-Bypass: 7 rot (5 davon im neuen Test, je 1 in `chatRoomAccess.test.js` und `chat.test.js`). Handbuch `90-chat`, `30-leitung`, `45-jahrgaenge`; API-Doku `chat-challenges.yaml`.

### BF-06: Termin gelöscht — gebuchtes Team erfährt es nie
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/events/verwaltung.js:872-879` (`r.name = 'konfi'`), Push `:1012-1015`
- **Kennzeichnung:** reproduziert (A8)
- **Beschreibung:** Die Absage (`:1188-1192`) benachrichtigt alle Gebuchten, das Löschen eines nicht abgesagten Termins nur Konfis (Stamm-Rolle). Gebuchte Teamer:innen und Leitungen, die sich selbst eingetragen haben, bekommen nichts; die Termin-Mitteilungen in ihrem Postfach werden dabei mitgelöscht (`:957`). Bei „Nur Team"-Terminen gibt es gar keine Empfänger.
- **Auswirkung aus Nutzersicht:** Eine Teamer:in hat für das Teamtreffen zugesagt, der Termin wird gelöscht, sie erfährt nichts und steht am Tag vor verschlossener Tür.
- **Beleg:** `A8 DELETE /events/90 -> 200 | Pushes danach: [] | Postfach teamer1: 0 | PUT /events/91/cancel -> 200 | Pushes: ["teamer1"]`.
- **Empfehlung:** Empfänger wie bei der Absage (alle Gebuchten `confirmed`/`waitlist`/`excused`, ohne Rollenfilter). Test: „Nur Team"-Termin mit Teamer-Buchung löschen → Push an die Teamer:in.
- **Status:** behoben 27.09.2026 — Absage und Löschen lesen dieselbe Auswahl `ladeBetroffeneEinesAusfalls` (`backend/utils/bookingUtils.js`): alle Gebuchten `confirmed`/`waitlist`/`excused` jeder Rolle, ohne gelöschte Konten; Push und Postfach „Event abgesagt" wie bisher ohne Termin-Kennung. Ein bereits abgesagter Termin meldet sich beim Löschen weiterhin nicht ein zweites Mal. Tests `tests/routes/terminLoeschenMitteilung.test.js` (5, inkl. Parität Absage ↔ Löschen).

### BF-07: Challenge-Start — das Team bekommt nichts
- **Schwere:** HOCH
- **Fundstelle:** `backend/services/pushService.js:2032-2075` (nur `r.name = 'konfi'` über `challenge_jahrgang_assignments`), Aufruf `backgroundService.js:726`; Zähler `challengeNeuigkeiten.js` (Team zählt nur Beiträge, keine ungeöffnete Challenge); Handbuch `80-challenges.md:479`
- **Kennzeichnung:** reproduziert (A9)
- **Beschreibung:** „Nur das Team"-Challenges haben keine Jahrgänge, also auch keine Empfänger; bei „Jahrgang und Team" bekommen nur die Konfis die Start-Mitteilung. Das Team sieht beide in der Liste und darf einreichen, bekommt aber weder Push noch eine Zahl für die neue Challenge.
- **Auswirkung aus Nutzersicht:** Eine Team-Challenge startet lautlos; wer nicht zufällig in die Liste schaut, macht nicht mit.
- **Beleg:** `A9 Start nur_team -> Push an [] | Start konfis_und_team (J1) -> Push an ["konfi1","konfi2"] | teamer1 aktive Challenges [31,30] | teamer1 challengeUpdates {"total":0,"byChallenge":{}}`.
- **Empfehlung:** Nach F-04: Start-Mitteilung für „Nur das Team" an Admins und Teamer:innen der Gemeinde, für „Jahrgang und Team" zusätzlich an das Team der Jahrgänge (Regel aus `challengeLeitungSicht.js`, Org-Admins immer); „nie geöffnet" auch im Leitungs-Zähler. Handbuch `80-challenges.md:479` ergänzen.
- **Status:** behoben 27.09.2026 — nach der Empfehlung zu F-04: Regel-Stelle `backend/utils/challengeLeitungSicht.js` (`TEAM_MACHT_MIT_AUDIENCES`, `teamMachtMitSql`, `ladeTeamDasMitmacht`), gelesen von der Team-Teilnahmeliste `GET /api/challenges/konfi`, `maySubmit`, der Start-Mitteilung (`pushService.sendChallengeStartedToJahrgaenge`) und dem Zähler (`challengeNeuigkeiten.js`: nie geöffnete, laufende Challenge = 1, wo das Team mitmacht). Empfänger: „Nur das Team" das ganze Team der Gemeinde (beide Zugehörigkeitsquellen), „Jahrgang und Team" Konfis und Team der Jahrgänge (`can_view`) plus Org-Admins, „Nur die Konfis" nur Konfis; ohne Doppelte, `created_by` nie. `badge-counts` unverändert in der Form. Tests `tests/services/challengeStartEmpfaenger.test.js` (16, inkl. Parität mit der Teilnahmeliste).

### BF-08: Mitgliedschaftsende über den Super-Admin lässt Chat-Plätze stehen
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/organizations.js:1243-1276` (`DELETE /organizations/:id/members/:userId`: nur `syncTeamChat` und `syncJahrgangChat`), gegenüber `backend/routes/users.js:688-694` (Org-Admin-Weg räumt seit 27.09. alle Räume)
- **Kennzeichnung:** reproduziert (A12)
- **Beschreibung:** Der Fix von heute früh (Commit 1eec4910) steht nur im Org-Admin-Weg. Der Super-Admin-Weg entfernt die Mitgliedschaft, die Syncs erfassen Team- und Jahrgangs-Chats; Gruppen, Einzelchats und Termin-Chats bleiben. Der Chat-Push geht an alle Teilnehmenden eines Raums. Auch die Jahrgangs-Zuweisungen der Gemeinde bleiben stehen und gelten bei einer erneuten Aufnahme sofort wieder.
- **Auswirkung aus Nutzersicht:** Eine Person, die nicht mehr zur Gemeinde gehört, bekommt weiter jede Nachricht aus deren Gruppen aufs Handy — auch von Konfis.
- **Beleg:** `A12 DELETE /organizations/2/members/5 -> 200 {"message":"Mitgliedschaft entfernt"} | Platz in Raum 50 danach: 1 | Nachricht 200 -> Chat-Push an ["orgAdmin1","orgAdmin2"]`.
- **Empfehlung:** Dieselbe Transaktion wie `users.js:666-694` (Zuweisungen der Gemeinde und alle Chat-Plätze der Gemeinde löschen); am besten eine gemeinsame Funktion für beide Wege. Test wie A12.
- **Status:** behoben 27.09.2026 — gemeinsame Funktion `backend/utils/mitgliedschaftEnde.js` (`gemeindeZugehoerigkeitRaeumen`: Zuweisungen und alle Chat-Plätze der Gemeinde), genutzt an allen drei Stellen: `organizations.js` `DELETE /:id/members/:userId` (jetzt eine Transaktion mit dem Löschen von `user_organizations`, danach Sync nur der betroffenen Jahrgänge und Sockets getrennt wie in `users.js`), `users.js` Fall 1 und `kontoZiehtUm` (dort ersetzt sie die beiden eigenen Kopien). Antwortform unverändert. Tests `organizations.test.js` „Ende der Mitgliedschaft räumt …" (verboten: keine Plätze in Raum 4, Gruppe, Zweierraum und keine Zuweisung auf Jahrgang 2 mehr; erlaubt: Räume 1–3 und Jahrgang 1 der Stamm-Gemeinde und die übrigen Teilnehmenden bleiben). Vor dem Fix beide rot; Gegenprobe Aufruf entfernt → 2 rot; Funktion ohne Gemeinde-Grenze → 3 rot (je einer in `organizations`, `users` Fall 1, `users` Umzug).

### BF-09: Lizenz-Erinnerung nur an die Stamm-Leitung, dafür auch an gebundene Admins
- **Schwere:** HOCH
- **Status:** behoben 27.09.2026 — `runLicenseReminders` (`backend/services/backgroundService.js`) nimmt `ladeMitgliederDerOrganisation(db, org, ['org_admin'])`: alle Org-Admins über beide Quellen, keine Admins, gesperrte Konten nicht (F-15). Test `tests/services/jahrgangLeitungEmpfaenger.test.js` („Lizenz-Erinnerung").
- **Fundstelle:** `backend/services/backgroundService.js:1405-1414` (`u.organization_id = $1 AND r.name IN ('admin','org_admin')`)
- **Kennzeichnung:** reproduziert (A15)
- **Beschreibung:** Einziger Leitungs-Versand, der `user_organizations` noch nicht kennt (im Bericht vom 26.09. als BF-14 NIEDRIG notiert, nicht behoben). Laut `chat.js:265-270` hat Organisation 2 in Produktion ihre gesamte Leitung nur über `user_organizations` — dort erreicht die Erinnerung niemanden. Nach Ablauf sperrt `runTrialExpiry` (`backgroundService.js:1360-1378`) jede Gemeinde mit abgelaufenem `trial_ends_at`, auch bezahlte. Umgekehrt geht die Mail an Admins, die mit der Lizenz nichts zu tun haben.
- **Auswirkung aus Nutzersicht:** Eine Gemeinde, deren Leitung über eine Einladung mitarbeitet, wird ohne Vorwarnung gesperrt.
- **Beleg:** Org 2 mit `orgAdmin1` als Zusatz-Org-Admin: `A15 Lizenzmail Org 2 an ["admin2@beispiel.invalid","orgadmin2@beispiel.invalid"]` — `orgAdmin1` fehlt, `admin2` (ohne Jahrgang) ist dabei.
- **Empfehlung:** `ladeMitgliederDerOrganisation(db, org, ['org_admin'])` (F-15). Test: Zusatz-Org-Admin bekommt sie, Admin nicht.

### BF-10: „Events warten auf Verbuchung" nennt gebundenen Admins die Zahl der ganzen Gemeinde
- **Schwere:** MITTEL
- **Status:** behoben 27.09.2026 — `checkPendingEvents` zählt je Person über `zaehleWartendeTermineJeLeitung` (`backend/utils/terminLeitungSicht.js`) mit derselben Regel wie `badge-counts.pendingEvents` und versendet je Gemeinde und Zahl einmal; wer 0 hat, bekommt nichts. Kosten: zwei Abfragen je Gemeinde für die Empfänger, eine Zählung für alle Personen (Test: 3 Abfragen für 3 wie für 13 Leitungspersonen). „Wartet auf Verbuchung" ist eine Bedingung (`terminWartetAufVerbuchungSql`) für Reiter, App-Symbol und Erinnerung: ab Beginn des Events (wie der Reiter der App), ohne abgesagte Events und ohne Buchungen gelöschter Konten (wie die Liste). Test `tests/services/verbuchenErinnerung.test.js`.
- **Fundstelle:** `backend/services/backgroundService.js:999-1016` (Zählung je Gemeinde), `pushService.js:2342`
- **Kennzeichnung:** reproduziert (A6)
- **Beschreibung:** Der tägliche Lauf zählt je Gemeinde und schickt dieselbe Zahl an alle Admins; der Verbuchen-Reiter zählt für gebundene Admins nur sichtbare Termine. Der Postfach-Eintrag ersetzt sich täglich (`ERSETZENDE_ARTEN`) und zählt am App-Symbol mit.
- **Auswirkung aus Nutzersicht:** Admin B liest „2 Events warten auf Anwesenheitsverbuchung", sein Reiter zeigt keinen davon.
- **Beleg:** `A6 Cron events_pending_approval -> ["admin1:2","adminB(J3):2","adminOhneJg:2","orgAdmin1:2","orgAdminSuper:2"]`, `adminB /events enthaelt 71/72: false false`.
- **Empfehlung:** Je Empfänger zählen — dieselbe Bedingung wie `terminZaehlerGebunden` (nach BF-11); Admins mit 0 bekommen nichts.

### BF-11: Verbuchen-Zähler gebundener Admins zählt „Team gesucht"-Termine fremder Jahrgänge
- **Schwere:** MITTEL
- **Status:** behoben 27.09.2026 — `badge-counts.pendingEvents` (`routes/notifications.js`) und `terminZaehlerGebunden` (`utils/appIconBadge.js`) filtern über `gebundeneLeitungSiehtTerminSql` (`backend/utils/terminLeitungSicht.js`) ohne `teamer_needed`; dieselbe Regel wie die Eventliste. Test `tests/services/verbuchenErinnerung.test.js` (Liste, Reiter, App-Symbol, Detail 403, Erinnerung).
- **Fundstelle:** `backend/routes/notifications.js:211`, `backend/utils/appIconBadge.js:166` (`e.teamer_only OR e.teamer_needed`) gegenüber `backend/routes/events/lesen.js:274-289` und `utils/jahrgangsZugriff.js:143-166` (`darfTermin`; `teamer_needed` zählt seit 08.09. nicht mehr)
- **Kennzeichnung:** reproduziert (A6)
- **Beschreibung:** Liste und `darfTermin` haben „Team gesucht" am 08.09. als Sichtbarkeitsgrund gestrichen, die beiden Zähler nicht. Der Termin zählt am Reiter und am App-Symbol, lässt sich aber weder finden noch öffnen.
- **Auswirkung aus Nutzersicht:** Eine rote Zahl am Verbuchen-Reiter, die nicht verschwindet — der Admin kann den Termin nicht verbuchen.
- **Beleg:** `A6 adminB badge-counts pendingEvents 1 | adminB /events enthaelt 71/72: false false | adminB GET /events/72 -> 403 | App-Symbol adminB 2 (davon Postfach 1)`.
- **Empfehlung:** `OR e.teamer_needed` an beiden Stellen streichen; Paritätstest (`appIconBadgeParitaet.test.js`) um den Fall ergänzen.

### BF-12: App-Symbol bei mehreren Gemeinden — falsche Rolle, Postfach mehrfach, und die App setzt eine andere Zahl
- **Schwere:** MITTEL
- **Fundstelle:** `backend/services/pushService.js:477-517, 546-562` (`berechneBadge`: Rolle aus `users.role_id` für jede Gemeinde), `:599-703` (`berechneBadgesFuerAlle`), `backend/services/backgroundService.js:226-352` (stiller Lauf, gleiche Rechnung); `backend/utils/appIconBadge.js:269-281` (Postfach ohne Gemeinde-Bezug, je Gemeinde-Aufruf erneut addiert); Client `frontend/src/contexts/BadgeContext.tsx:156-165, 466-478`; Handbuch `05-rollen.md:267-269`
- **Kennzeichnung:** reproduziert (A11)
- **Beschreibung:** Server-Symbol = Summe je Gemeinde, aber jede Gemeinde mit der **Stamm-Rolle** gerechnet: Wer zuhause Org-Admin und in Gemeinde B nur Teamer:in ist, bekommt Bs offene Anträge und Termine mitgezählt (er sieht sie dort nicht, 403). Zweitens zählt jede Gemeinden-Runde das ganze Postfach erneut — bei drei Gemeinden dreifach. `je-organisation` rechnet richtig (Rolle je Gemeinde, Postfach einmal). Die offene App setzt dagegen die Summe der **aktiven** Gemeinde (`badge-counts`); das Handbuch verspricht „über alle Gemeinden zusammen".
- **Auswirkung aus Nutzersicht:** Das Symbol springt: Push und Hintergrund setzen 5, die App beim Öffnen 2, der Umschalter zeigt 2 + 0.
- **Beleg:** `A11 berechneBadge (Push) = 5 | stiller Hintergrund-Push = 5 | je-organisation {"1":{"offen":2},"2":{"offen":0}} | App offen in Org 1 (Client-Summe) = 2 | Org 2 als Teamer:in: pendingRequests 0 Antragsliste Org 2 -> 403`.
- **Empfehlung:** Nach F-09 eine Rechnung für alle drei: Server-Symbol aus `appIconSummenJeOrganisation` mit `ladeMitgliedschaftenDerPerson` (Summe der Einträge), Postfach genau einmal; die App setzt dieselbe Zahl (Summe aus `je-organisation` statt nur aktiver Gemeinde). Paritätstest für eine Person mit zwei Gemeinden und verschiedenen Rollen.
- **Status:** behoben 27.09.2026 — Push (`berechneBadge`, `berechneBadgesFuerAlle`), Hintergrund-Lauf und Gemeinde-Umschalter lesen eine Funktion, `appIconSummenAllerGemeinden` (`utils/appIconBadge.js`), mit den Mitgliedschaften aus `ladeMitgliedschaftenVieler` (`utils/orgMitglieder.js`, `ladeMitgliedschaftenDerPerson` ist derselbe Weg mit einer Person): Summe über alle aktiven Gemeinden, je Gemeinde mit Rolle und Jahrgängen von dort, jede ungelesene Mitteilung genau einmal — bei ihrer Gemeinde, sonst (Gemeinde verlassen oder gesperrt) bei der Stamm-Gemeinde, damit Personen mit einer Gemeinde dieselbe Zahl behalten. Die offene App setzt bei mehreren Gemeinden die Summe aus `je-organisation` (`BadgeContext`, `appSymbolZahl`, parallel zu `badge-counts`), bei einer Gemeinde weiter `totalBadgeCount` ohne zusätzliche Abfrage. Nachgestellt (Org-Admin zuhause mit 2 Anträgen, Teamer:in mit Jahrgang in Org 2 mit 1 Antrag und 1 wartendem Beitrag, je 1 Mitteilung): Push und Hintergrund 8 → 5, Umschalter 3 + 2 = 5, App 4 → 5; Org-Admin in zwei Gemeinden mit einer Mitteilung 2 → 1. Ruhiger Hintergrund-Lauf (`abzeichenAuswahl.test.js`) 32 → 21 Abfragen; Seed / mit 40 weiteren Konten / zusätzlich mit einer dritten Gemeinde: vorher 32 / 32 / 38, jetzt 21 / 21 / 21. Tests `appIconMehrereGemeinden.test.js` (12), `orgMitglieder.test.js` (+6), `badgeAppSymbolAlleGemeinden.test.tsx` (6).

### BF-13: Postfach behält Mitteilungen über gelöschte Konfis und aus verlassenen Gemeinden
- **Schwere:** MITTEL
- **Fundstelle:** `backend/utils/konfiDeletion.js:83, 113` (räumt nur Antrags-Mitteilungen und die eigenen), `backend/utils/postfachAufraeumen.js` (keine Regel für Personen), `backend/routes/users.js:666-694` und `organizations.js:1243` (Mitgliedschaftsende ohne Postfach)
- **Kennzeichnung:** reproduziert (A13, Konto-Löschung); Mitgliedschaftsende aus Code gelesen
- **Beschreibung:** Nach dem Löschen einer Konfi bleiben bei der Leitung „Neue Registrierung", Abmeldungen, Opt-outs samt Grund und Challenge-Beiträge mit ihrem Namen stehen (Aufräumen nach 365 Tagen, `backgroundService.js:1293`). Nach dem Ende einer Mitgliedschaft liest die Person das Postfach der alten Gemeinde weiter; die Einträge zählen am App-Symbol, und das Antippen will in eine Gemeinde wechseln, der die Person nicht mehr angehört.
- **Auswirkung aus Nutzersicht:** „Test Konfi 2 hat sich … abgemeldet. Grund: Arzttermin Kinderpsychiatrie" steht nach der Löschung des Kontos noch ein Jahr bei fünf Personen.
- **Beleg:** `A13 DELETE /admin/konfis/2 -> 200 | Konto noch da: 0 | Postfach-Reste 5 z.B. {"user_id":4,"message":"Test Konfi 2 hat sich von 'Konfi-Unterricht' abgemeldet. Grund: Arzttermin Kinderpsychiatrie"} | Empfaenger ["admin1","orgAdmin1","orgAdminSuper","adminB(J3)","adminOhneJg"]`.
- **Empfehlung:** Nach F-07: `konfi_id` in den Leitungs-Mitteilungen mitführen (additiv im `data`-Teil) und beim Löschen `DELETE … WHERE data->>'konfi_id' = …`; beim Mitgliedschaftsende `DELETE FROM notifications WHERE user_id = … AND organization_id = …`.
- **Status:** behoben 27.09.2026 — F-07 (Simon: ja). Am Code geprüft, welche Leitungs-Mitteilungen über eine Person berichten und welchen Schlüssel sie trugen: `new_activity_request` hatte schon `konfi_id` (auch bei Teamer-Anträgen) und `request_id`, `gemeinde_einladung_beantwortet` schon `user_id`; sieben Arten trugen nur den Namen im Text — `event_unregistration`, `event_opt_out`, `event_opt_in` (`konfi_name`, `event_id`), `new_konfi_registration` (`jahrgang_id`), `challenge_submission` (`challengeId`), `teamer_event_booking`, `teamer_event_cancellation` (`eventId`). Sie tragen jetzt additiv `konfi_id` (die vier Konfi-Arten) bzw. `user_id` (Beitrag und Team-Zu-/Absage, jede Rolle; `pushService.js`, Aufrufer in `konfi.js`, `auth.js`, `teamer.js`, `events/buchung.js`). Eine Regel-Stelle `loescheMitteilungenUeberPerson` (`utils/postfachAufraeumen.js`, `ARTEN_UEBER_PERSON`, vergleicht beide Schlüssel) läuft in `deleteKonfiCascade` (Leitung, Selbstlöschung, Auto-Löschung) und im Nicht-Konfi-Weg `DELETE /users/:id` Fall 3. Mitgliedschaftsende: `gemeindeZugehoerigkeitRaeumen` (`utils/mitgliedschaftEnde.js`) löscht zusätzlich `notifications` der Person mit `organization_id` dieser Gemeinde — damit auf allen drei Wegen (Fall 1, Umzug, Super-Admin). Entzogene Jahrgangszuweisung räumt nichts (Verlauf). Bestandsdaten ohne Schlüssel werden nicht geraten und nicht migriert: betroffen wären die sieben genannten Arten; sie gehen weiter mit Termin bzw. Challenge oder nach 365 Tagen (Menge in Produktion nicht gemessen, kein Zugriff). Antwortformen unverändert. Test `tests/routes/postfachGehtMitKontoUndGemeinde.test.js` (11: echte Schreibwege Registrierung, Opt-out/-in, Abmeldung, Beitrag, Teamer-Zu-/Absage; Konfi-Löschung, Selbstlöschung, Teamer-Löschung, Fall 1, Super-Admin, Umzug je verboten und erlaubt mit `badge-counts.postfach.ungelesen` und `je-organisation` auf den konkreten Wert — z. B. Glocke Org-Admin 6 → 1, Umschalter `{1:2, 2:2}` → `{1:2}`; Jahrgang entzogen bleibt; Regel-Stelle). Vor dem Fix 10 von 11 rot (15 Reste über Emma bei 3 Personen, Glocke 6 statt 1). Gegenprobe: Aufruf in `konfiDeletion.js` entfernt → 3 rot; in `users.js` → 2 rot; Löschen in `mitgliedschaftEnde.js` entfernt → 3 rot; ohne Gemeinde-Grenze → 3 rot; `konfi_id` nicht geschrieben → 3 rot. Handbuch `03-bedienung`, `05-rollen`; API-Doku `konfis-events.yaml`, `verwaltung-auth.yaml`, `chat-challenges.yaml`.

### BF-14: Aus dem Termin ausgetragen oder auf die Warteliste gesetzt — keine Mitteilung
- **Schwere:** MITTEL
- **Status:** behoben 27.09.2026 — nach F-06 zwei neue Arten mit Push und Postfach-Eintrag: `event_removed` („Vom Event ausgetragen", `DELETE /events/:id/bookings/:bookingId`) und `event_waitlisted` („Auf die Warteliste gesetzt", `PUT …/status` auf `waitlist`), beide über `PushService.sendEventRemovedByLeitung`, nach der Antwort, nicht an die auslösende Person, beim Austragen nur für Buchungen `confirmed`/`waitlist`. Antippen führt an das Event; Apps ohne die Arten zeigen den Push und öffnen nur die App (`tests/routes/mitteilungBeimAustragen.test.js`, `frontend/src/__tests__/components/postfachUnbekannteArt.test.tsx`).
- **Fundstelle:** `backend/routes/events/teilnehmer.js:307-450` (nur Live-Signal `:446`), `:456-690` (Push nur bei Warteliste → bestätigt, `:658`)
- **Kennzeichnung:** reproduziert (A14, Austragen); Herabstufung aus Code gelesen
- **Beschreibung:** Eintragen durch die Leitung meldet sich (`:274/278`, Handbuch `70-termine.md:1118`), Austragen und Herabstufen nicht — weder Push noch Postfach. Die Terminliste der Person zeigt danach „nicht angemeldet".
- **Auswirkung aus Nutzersicht:** Eine Konfi hält sich den Termin frei, obwohl die Leitung sie ausgetragen hat.
- **Beleg:** `A14 DELETE /events/1/bookings -> 200 | Pushes an konfi1: [] | Postfach konfi1: 0`.
- **Empfehlung:** Nach F-06 eigene Art (z. B. `event_removed`) mit Postfach; bei Herabstufung „auf die Warteliste gesetzt".

### BF-15: Live-Signale gehen an das ganze Team bzw. alle Konfis der Gemeinde
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/utils/liveUpdate.js:107-158` (`sendToOrgAdmins`: alle `admin`/`org_admin`/`teamer`), `:169-217` (`sendToOrgKonfis`, `sendToOrg`), `:291-318` (`sendToUserByRole`: Stamm-Rolle)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Die Signale tragen nur Kennungen (`konfiId`, `userId`, `eventId`, `action: 'attendance'`) und lösen ein Nachladen der gefilterten Listen aus — Inhalte fließen nicht. Aber: Jedes Team-Mitglied erfährt, dass bei Konfi 17 gerade Punkte gebucht wurden, und lädt bei jedem Ereignis der Gemeinde seine Listen neu. `sendToUserByRole` wählt den Raum nach der Stamm-Rolle; wer in der aktiven Gemeinde eine andere Rolle hat, verpasst sein Signal.
- **Empfehlung:** Mittelfristig Empfänger wie bei den Mitteilungen; kurzfristig nur dokumentieren.
- **Status:** geprüft 27.09.2026 — **entspricht der Regel, weil ohne Inhalt**; kein Umbau. Am Code nachgezählt: 87 gemeindeweite Signale (80 × `sendToOrgAdmins`/`sendToOrgKonfis`/`sendToOrg`, 7 × `notifyLeadership` in `challenges.js`), davon 45 mit Nutzdaten — ausschließlich Kennungen (`eventId`, `konfiId`, `userId`, `challengeId`, `seriesId`), `count` und `action` als kurzes Wort; kein Name, Text, Grund, keine Punkte. Die App wertet `data` nicht aus (`LiveUpdateContext`/`useLiveRefresh` lösen nur ein Nachladen aus, ebenso Tag 2.2.0) und lädt über die Routen, die die Regel prüfen. Signale an eine Person (`sendToUser`, `sendToKonfi`, `sendToUserByRole`, 44 Aufrufe) und an einen Jahrgang (`sendToJahrgang`, 2) erreichen nur die Betroffenen; Chat-Signale mit Inhalt (`newMessage`, Umfragen, Reaktionen, Tippen) gehen nur an Teilnehmende bzw. an den Socket-Raum, den `darfRaumBetreten` öffnet (BF-05). Signale mit Inhalt an Personen außerhalb der Regel: keine gefunden. Festgehalten mit `tests/utils/liveSignaleOhneInhalt.test.js` (3: Scan aller Aufrufe in `routes`, `services`, `utils` samt Weiterreichung, erlaubte Schlüssel, Prüfer im Kleinen); Gegenprobe: `display_name` in das Signal der Registrierung (`auth.js`) → 1 rot, Beitragstext in `notifyLeadership` → 1 rot. Offen, aber keine Verletzung der Regel: `sendToUserByRole` wählt den Raum nach der Stamm-Rolle — wer in der aktiven Gemeinde eine andere Rolle hat, verpasst sein eigenes Nachlade-Signal (kein Fremdempfang).

### BF-16: Empfängerlisten mit Jahrgangsfilter prüfen `can_view` nicht
- **Schwere:** NIEDRIG
- **Status:** behoben 27.09.2026 — Der Jahrgangsfilter in `ladeMitgliederDerOrganisation` (`backend/utils/orgMitglieder.js`) verlangt `uja.can_view = true`; das betrifft die Challenge-Beitrags-Mitteilung (und bis zur Umstellung unter BF-03 die Registrierung). Tests `tests/utils/orgMitglieder.test.js`, `tests/routes/challengeAdminBeteiligung.test.js` (Liste, Reiter und Mitteilung bei `can_view = false`). In Produktion nicht gezählt (kein Zugriff); die App legt Zuweisungen immer mit Leserecht an.
- **Fundstelle:** `backend/utils/orgMitglieder.js:45-54` (nur `uja.jahrgang_id = ANY(…)`), genutzt von `pushService.js:2271` (Challenge-Beitrag) und `:2410` (Registrierung); Listen, Zähler und Jahrgangs-Chat verlangen `can_view` (`notifications.js:100`, `jahrgangChat.js:85, 96`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Eine Zuweisung mit `can_view = false` löst Mitteilungen aus, ohne dass die Person den Vorgang sieht. Ob es solche Zuweisungen in Produktion gibt, ist offen.
- **Empfehlung:** `AND uja.can_view = true` im Filter; Zählung in Produktion (unten).

### BF-17: Termin-Chat und Handbuch laufen auseinander
- **Schwere:** NIEDRIG
- **Status:** behoben 27.09.2026 — nach F-11 der Code angeglichen, nicht nur das Handbuch: Der Code nahm entgegen der Empfehlung Wartende und Abgemeldete auf (Anlegen `eb.status <> 'cancelled'`, jede spätere Buchung samt Warteliste). Jetzt tragen `addToEventChat` und `syncEventChat` (`utils/eventChat.js`) nur bei bestätigter Buchung ein — damit gilt die Regel für Anlegen, Anmelden, Eintragen, Teamer-Zusage, Pflicht-Automatik und Wiederanmeldung zugleich; Wartende kommen beim Nachrücken hinein, Herabstufen auf die Warteliste nimmt heraus (`teilnehmer.js`). Die Pflicht-Abmeldung und die Leitungs-Abmeldung bei der Anwesenheit nehmen weiterhin niemanden heraus (Entscheidung 24.08.2026, im Handbuch als Ausnahme benannt). Handbuch `70-termine` („Einen Event-Chat einrichten", Stolperstein, „Leitung" statt „Leitung oder Team", Beispiel zum verschlossenen Event) und `90-chat` angepasst (`tests/routes/terminChatNurBestaetigte.test.js`).
- **Fundstelle:** `backend/utils/eventChat.js:100` (`eb.status <> 'cancelled'`: Warteliste, `opted_out` und `excused` kommen beim Anlegen hinein), `backend/utils/bookingUtils.js:950, 1055` (jede spätere Buchung, auch Warteliste, kommt hinein), `verwaltung.js:1033` (`requireAdmin`) gegenüber Handbuch `70-termine.md:1078-1088` („Leitung oder Team", „Wer auf der Warteliste steht, ist nicht dabei", „Wer sich nach dem Anlegen anmeldet, wird nicht hinzugefügt") und `90-chat.md:27, 90-95`; außerdem `70-termine.md:288-292` („Die Mitteilung kommt, der Termin selbst bleibt zu") — das Beispiel verhindert der Code seit 25.09. (`teilnehmer.js:89-96`), der Satz widerspricht der Regel „Mitteilung = Sichtbarkeit"
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Wer im Termin-Chat ist und dessen Push bekommt, bestimmt der Code anders, als das Handbuch es sagt.
- **Empfehlung:** Nach F-11 Code oder Handbuch angleichen.

### BF-18: Konfi-Storno über `DELETE /events/:id/book` meldet sich bei niemandem
- **Schwere:** NIEDRIG
- **Status:** behoben 27.09.2026 — Nicht gesperrt, sondern angeglichen: Der reguläre Weg der App ist `DELETE /konfi/events/:id/register`; `/events/:id/book` ruft für Konfis keine App-Fassung (geprüft 1.5.3, 2.0.0, 2.1.1, 2.2.0, HEAD), hat aber seit 26.09. dieselben Regeln (`pruefeKonfiStorno`) und dasselbe Protokoll. Jetzt auch dieselben Mitteilungen (`routes/events/buchung.js`): Bestätigung an die Konfi und „Event-Abmeldung" samt Grund an die Leitung, die das Event sieht. Test `tests/routes/terminLeitungEmpfaenger.test.js` (beide Wege: gleiche Empfänger, gleicher Text).
- **Fundstelle:** `backend/routes/events/buchung.js:101-305` (Protokoll ja, Push an Leitung und Bestätigung an die Konfi nein) gegenüber `konfi.js:1826-1836`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Die App nutzt für Konfis `DELETE /konfi/events/:id/register`; der generische Weg ist nur per Schnittstelle erreichbar (auch in Tag 2.2.0 nicht aus der App gerufen). Die Abmeldung steht dann in der Liste der Leitung, ohne Mitteilung.
- **Empfehlung:** Für Konfis dieselben Meldungen wie `konfi.js` oder den Weg für Konfis sperren.

### BF-19: Beförderte Person bleibt ohne Zuweisung im alten Jahrgangs-Chat
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/konfi-management.js:1648-1649` (Teilnahme wird auf `teamer` umgeschrieben, kein Abgleich), Kommentar `:1636-1640`
- **Kennzeichnung:** reproduziert (A16)
- **Beschreibung:** Bis irgendwer anderes den Abgleich dieses Jahrgangs auslöst (Leitung oder Konfi öffnet den Chat nach Ablauf des 10-Minuten-Merkers), bekommt die frisch beförderte Teamer:in jede Nachricht der ehemaligen Mitkonfis. Ihr eigenes Öffnen der Chats gleicht den alten Jahrgang nicht ab (sie hat keine Zuweisung).
- **Beleg:** `A16 promote -> 200 | Zuweisungen 0 | Platz im Jahrgangs-Chat [{"user_type":"teamer"}] | Chat-Push an ["admin1","konfi2","teamer1"]`.
- **Empfehlung:** Nach dem Commit `syncJahrgangChat` für den alten Jahrgang aufrufen.
- **Status:** behoben 27.09.2026 — am Code geprüft: Die Beförderung übernimmt den alten Jahrgang bewusst **nicht** als Zuweisung (Schritt 6, seit 01.09.2026, Handbuch `05-rollen`/`45-jahrgaenge`); der Verbleib im Jahrgangs-Chat widerspricht also der Regel (Teamer:innen nur in Chats zugewiesener Jahrgänge). Ebenso, bei der Prüfung gefunden: Die Beförderung löscht alle Buchungen, ließ aber die Plätze in deren Termin-Chats stehen (dieselbe Fehlerklasse, gemessen: vorher Plätze `[1, Termin-Chat]` als `teamer`), und den Team-Chat bekam die neue Teamer:in erst nach Ablauf des 10-Minuten-Merkers. Jetzt in derselben Transaktion (`konfi-management.js`, Schritt 9b): `syncJahrgangChat` für den alten Jahrgang mit der neuen Rolle (ohne `can_view`-Zuweisung heraus, mit Zuweisung bleibt sie als `teamer`), `removeFromEventChat` für jeden gebuchten Termin, `syncTeamChat`; danach `chatSyncCache.invalidate`. Zweiergespräche und Gruppen bleiben (bestehende Räume sperrt die Regel nicht nachträglich, Entscheidung 01.09.2026). Tests `konfi-management.test.js` „BF-19: …" (verboten: ohne Zuweisung genau ein Platz, der Team-Chat; erlaubt: mit Zuweisung Raum 1 als `teamer` plus Team-Chat, die Mitkonfis bleiben). Vor dem Fix beide rot; Gegenprobe ohne Jahrgangs-Abgleich → 1 rot, ohne Termin-Austritt → 1 rot, pauschales Entfernen aus allen Jahrgangs-Chats statt Abgleich → 1 rot (der erlaubte Fall).

### BF-20: Passwort vergessen wählt das Konto nicht eindeutig; Passwortänderung bleibt ohne Mail
- **Schwere:** NIEDRIG
- **Status:** behoben 27.09.2026 — „Passwort vergessen" (`auth.js`, `POST /auth/request-password-reset`) wählt nur Konten mit `deleted_at IS NULL` und `is_active` nicht `false`; jedes Konto zur Adresse bekommt einen eigenen Token und eine eigene Mail (bei mehreren mit Gemeinde im Betreff, Gemeinde und Benutzername im Text — eine Mail je Konto, weil die Vorlage genau einen Knopf und eine Anrede trägt); Antwort unverändert neutral, Versand nach der Antwort. Nach F-12 geht `sendPasswordChangedEmail` über `utils/passwortGeaendertMail.js` nach der Antwort an die hinterlegte Adresse — auf allen fünf Wegen: selbst geändert, Link, `PUT /users/:id` mit Passwort, `PUT /users/:id/reset-password`, `POST /admin/konfis/:id/regenerate-password` (die drei Leitungswege mit „die Leitung hat gesetzt", ohne Passwort). Nebenbei: Die Reset-Mail nannte „1 Stunde", der Link galt 24 h (`tests/routes/passwortMails.test.js`).
- **Fundstelle:** `backend/routes/auth.js:756-761` (`WHERE u.email = $1`, ohne `deleted_at`/`is_active`, erster Treffer), Schema `idx_…_users_2` (E-Mail nur je Gemeinde eindeutig); `backend/services/emailService.js:193` (`sendPasswordChangedEmail`, nirgends gerufen)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Tragen zwei Konten verschiedener Gemeinden dieselbe Adresse, bekommt nur eines den Link; gesperrte und ausgeblendete Konten bekommen ihn auch. Eine Bestätigung nach einer Passwortänderung gibt es nicht.
- **Empfehlung:** Konten ohne `deleted_at` und mit `is_active` wählen; bei mehreren Treffern je Konto einen Link (F-12 zur Bestätigungsmail).

### BF-21: Einladung beantwortet — die einladende Leitung erfährt nichts
- **Schwere:** NIEDRIG
- **Status:** behoben 27.09.2026 — nach F-13 neue Art `gemeinde_einladung_beantwortet` mit Push und Postfach-Eintrag („Einladung angenommen"/„abgelehnt", `PushService.sendEinladungBeantwortetToLeitung`, aus `einladungen.js` nach der Antwort). Gespeichert ist `org_einladungen.eingeladen_von`; Empfänger ist diese Person, solange sie in der Gemeinde Org-Admin ist (beide Quellen, `orgMitglieder.js`) — einladen und die Einladungen sehen darf nur `org_admin` —, sonst die Org-Admins der Gemeinde, nie die eingeladene Person selbst. Beim Annehmen zusätzlich Live-Signal `users` an die Gemeinde. Antippen führt zu `/admin/users` (`tests/routes/einladungBeantwortet.test.js`).
- **Fundstelle:** `backend/routes/einladungen.js:275-340` (keine Mitteilung, kein Live-Signal; die offene Einladung verschwindet nur aus `GET /einladungen`)
- **Kennzeichnung:** aus Code gelesen
- **Empfehlung:** Nach F-13 Postfach-Eintrag an die einladende Person; Live-Signal `users` an die Gemeinde.

### BF-22: Gesperrte Gemeinde — Hintergrund-Mitteilungen laufen weiter
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/services/backgroundService.js:853-932` (Erinnerungen), `:633-650` (Anmeldestart), `:712-722` (Challenge-Start), `pushService.js:353-368` (Token-Abfrage prüft Konto, nicht Gemeinde)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Nach Ablauf der Lizenz (`organizations.is_active = false`) kommen Erinnerungen und „Neues Event!" weiter, die App lässt die Anmeldung aber nicht mehr zu („Organization is inactive", `rbac.js:183-185`). Verwandt mit BF-14 vom 26.09. (Jahres-Cron).
- **Empfehlung:** In `getTokensForUser(s)` zusätzlich die Gemeinde des Inhalts prüfen oder die Läufe auf aktive Gemeinden beschränken.
- **Status:** behoben 27.09.2026 — Läufe auf aktive Gemeinden beschränkt, ausgerichtet an Anmeldung und Zugriff: Login 403 bei `organization_active = false` (`auth.js`), jede Anfrage 401 „Organization is inactive" (`rbac.js`), gesperrte Gemeinden fehlen in `my-organizations` und am Umschalter (`ladeMitgliedschaftenVieler`). Eine Bedingung `NUR_AKTIVE_GEMEINDE` (`COALESCE(o.is_active, true) = true`, wie `rbac.js`) im Kopf von `services/backgroundService.js`, eingesetzt in den Sammelabfragen: Erinnerungen 24 h/1 h (beide Abfragen), Anmeldestart „Neues Event!", Challenge-Start, „Events warten auf Verbuchung", Zähler- und Abzeichen-Lauf (Stamm-Gemeinde des Kontos; wer dort gesperrt ist, kann sich nicht anmelden), Team-Rückblick am 6.1., Löschwarnung (Push, Postfach, Mail). Die Auto-Löschung läuft weiter (Fristen), nur ihre Nachrück-Meldung bleibt in einer gesperrten Gemeinde aus. Die Lizenz-Erinnerung fragte schon `is_active = true`. Merker (`registration_open_notified`, `start_push_sent`, `event_reminders`, `deletion_reminder_sent_at`) bleiben für die gesperrte Gemeinde offen — nach einer Freigabe kommt nach, was noch ansteht. `getTokensForUser(s)` bleibt unverändert: Ereignis-Pushes entstehen nur aus Anfragen, und die lässt `rbac.js` in einer gesperrten Gemeinde nicht zu. Kosten: keine Abfrage mehr — „ruhiger Lauf" (`abzeichenAuswahl.test.js`) weiter 21 Abfragen. Test `tests/services/gesperrteGemeindeHintergrund.test.js` (8, je Lauf gesperrte Org 2 bekommt nichts, aktive Org 1 wie bisher; Merker offen). Vor dem Fix 8 von 8 rot; Gegenprobe Bedingung wirkungslos → 8 rot; nur Nachrück-Sperre entfernt → 1 rot; nur Filter im Zähler-Lauf entfernt → 1 rot. Nicht geändert: Liegt die Testphase schon hinter `trial_ends_at`, sperrt erst der 03:00-Lauf die Gemeinde (`runTrialExpiry`); bis dahin gilt sie hier wie in `rbac.js` als aktiv, nur der Login prüft das Datum selbst. Handbuch `03-bedienung` („Benachrichtigungen wieder zum Laufen bringen"), `70-termine`, `95-wrapped`; API-Doku `teamer-material.yaml` (Wrapped-Cron).

## Offene Fragen an Simon

**Beantwortet 27.09.2026.** Simon hat F-06, F-07, F-08, F-11, F-12 und F-13 jeweils mit „ja"
beantwortet, also wie empfohlen. F-01 bis F-05, F-09, F-10, F-14 und F-15 folgen direkt aus der Regel
in CLAUDE.md („Wer sieht und bekommt was": Org-Admin alles; Admin und Teamer:in nur ihre Jahrgänge,
Team-Ausnahmen „Nur Team", Termine ohne Jahrgang, Chat im Team; Mitteilung = Sichtbarkeit) und
werden wie empfohlen umgesetzt. Die Umsetzung steht je Befund in dessen Status-Zeile.

**Nachfrage zu F-11, beantwortet 27.09.2026:** Pflicht-Abmeldung und die Abmeldung durch die Leitung
bei der Anwesenheit nehmen niemanden aus dem Event-Chat — Simons Entscheidung vom 24.08.2026 („der
Termin betrifft einen ja weiter") bleibt. Hinein kommen nur bestätigt Angemeldete, Wartende beim
Nachrücken; wer auf die Warteliste zurückgesetzt wird, verlässt den Event-Chat.

- **F-01 (BF-05):** Dürfen Admins (nicht Org-Admins) ohne eigene Teilnahme Jahrgangs-Chats, Termin-Chats und Gruppen mit Konfis fremder Jahrgänge öffnen? *Empfehlung: Nein — ohne Teilnahme nur Räume ihrer Jahrgänge, Termin-Chats von Terminen, die sie sehen, und reine Team-Räume; nur Org-Admins bleiben gemeindeweit.* **Status:** entschieden 27.09.2026 (Nein, wie empfohlen; Regel in CLAUDE.md) und mit BF-05 umgesetzt.
- **F-02 (BF-03):** Sollen Teamer:innen des Jahrgangs „Neue Registrierung" auch bekommen? *Empfehlung: Nein, das ist Leitungssache (Konfis bearbeiten nur Admins); Empfänger Org-Admins und Admins des Jahrgangs.*
- **F-03 (BF-02, BF-03):** Wenn niemand dem Jahrgang zugewiesen ist — genügt dann die Meldung an die Org-Admins? *Empfehlung: Ja, kein Rückfall an alle Admins.*
- **F-04 (BF-07):** Soll die Start-Mitteilung einer Challenge bei „Nur das Team" an das ganze Team und bei „Jahrgang und Team" auch an das Team des Jahrgangs gehen (bei „Nur die Konfis" nicht)? *Empfehlung: Ja, und „neue Challenge" zählt dann auch beim Team als Neuigkeit.*
- **F-05 (BF-04):** Sollen Konfis Termine ohne Jahrgang sehen und dafür „Neues Event" bekommen (heute: Mitteilung ja, sehen nein)? *Empfehlung: Nein — Termine ohne Jahrgang gelten dem Team; Konfis bekommen „Neues Event" nur für Termine ihres Jahrgangs.*
- **F-06 (BF-14):** Soll eine Person benachrichtigt werden, wenn die Leitung sie aus einem Termin austrägt oder auf die Warteliste zurücksetzt? *Empfehlung: Ja, mit Postfach-Eintrag, wie beim Eintragen.*
- **F-07 (BF-13):** Sollen Leitungs-Mitteilungen über eine Konfi mit ihrem Konto verschwinden, und die Mitteilungen einer Gemeinde mit dem Ende der Mitgliedschaft dort? *Empfehlung: Ja für beides; bei entzogener Jahrgangszuweisung bleiben sie als Verlauf.*
- **F-08 (Matrix):** Bleiben Teamer-Anträge „nur fürs Team", also an alle Admins der Gemeinde wie heute? *Empfehlung: Ja — Teamer-Aktivitäten haben keinen Jahrgang, die Antragsliste zeigt sie allen Admins.*
- **F-09 (BF-12):** Zeigt das App-Symbol die Summe über alle Gemeinden (Handbuch, Server) oder nur die aktive Gemeinde (App heute)? *Empfehlung: Summe über alle Gemeinden, je Gemeinde mit der dortigen Rolle — dieselbe Rechnung wie der Gemeinde-Umschalter.*
- **F-10 (BF-01):** Bekommen bei Termin-Meldungen („Teamer:in abgemeldet", Konfi-Abmeldung) nur Admins des Jahrgangs und Org-Admins die Mitteilung, bei „Nur Team" und ohne Jahrgang alle Admins? *Empfehlung: Ja, genau so.*
- **F-11 (BF-17):** Sollen später Angemeldete und Wartende automatisch in den Termin-Chat kommen (Code: ja, Handbuch: nein)? *Empfehlung: Bestätigte ja, Wartende erst beim Nachrücken; Abgemeldete nicht; Handbuch anpassen.*
- **F-12 (BF-20):** Soll nach einer Passwortänderung eine Bestätigung an die hinterlegte Adresse gehen (die Vorlage existiert)? *Empfehlung: Ja, für Konten mit E-Mail.*
- **F-13 (BF-21):** Soll die einladende Leitung erfahren, dass eine Einladung angenommen oder abgelehnt wurde? *Empfehlung: Ja, als Postfach-Eintrag.*
- **F-14 (BF-01):** Geht die Jahrgangs-Löschwarnung an Admins des Jahrgangs auch mit reinem Lesezugriff (Befördern braucht Schreibrecht)? *Empfehlung: Org-Admins und Admins des Jahrgangs mit Schreibrecht.*
- **F-15 (BF-09):** Geht die Lizenz-Erinnerung nur an Org-Admins? *Empfehlung: Ja, an alle Org-Admins der Gemeinde (beide Quellen), nicht an Admins.*

## Geprüft und in Ordnung

- **Zugehörigkeit je Gemeinde:** Alle Leitungs-Empfänger außer der Lizenzmail über `orgMitglieder.js` (Stamm-Gemeinde mit `users.role_id`, Zusatz mit `uo.role_id`); wer in B nur Teamer:in ist, bekommt dort keine Leitungs-Meldung (`pushEmpfaengerMultiOrg.test.js`, grün). Gesperrte und gelöschte Konten fallen in den Empfängerlisten und zentral in `getTokensForUser(s)` heraus (`pushService.js:353-419`).
- **Super-Admin:** In keiner Empfängerliste (Rolle `super_admin` fehlt in `LEITUNGSROLLEN`, in allen `liveUpdate`-Abfragen, in Team- und Jahrgangs-Chat, im Zähler-Lauf `backgroundService.js:239`); in allen Tests A1–A16 kein Push an ihn. Org-Admins mit Super-Admin-Merkmal zählen als Org-Admin.
- **Challenge-Beiträge:** Liste, Reiter, App-Symbol und Mitteilung folgen seit heute einer Regel (`challengeLeitungSicht.js`); Einreicher:in ausgenommen; Galerie-Push nur an die Konfis der Jahrgänge und nur für sichtbare Beiträge (`feedPushSichtbarkeit.test.js`).
- **Konfi-eigene Mitteilungen:** Antrag, Punkte, Level, Abzeichen, Stempel, Anwesenheit, Anmeldung, Nachrücken, Rückblick gehen nur an die Person bzw. den Jahrgang; Pflicht-Event nur an die Jahrgänge des Termins; Absage, Änderung, Rücknahme und Erinnerungen an alle Gebuchten einschließlich Team und Leitung.
- **Jahrgangs- und Team-Chat:** Mitgliedschaft nach der Regel (Org-Admins immer, Admin/Teamer:in mit `can_view`, Konfis des Jahrgangs; Team-Chat für das ganze Team); Einzelchats bleiben privat, auch für die Leitung; Anlegen jahrgangsgebunden in beide Richtungen (`chat.js:363-520`).
- **Listen:** Anträge, Konfis, Termine, Termin-Detail, Jahrgänge, Challenges, Material jahrgangsgebunden mit den Ausnahmen „Nur Team" und ohne Jahrgang; Admins und Teamer:innen ohne Jahrgang sehen nur diese Ausnahmen, Admins dazu die Teamer-Anträge (Kopfzeile `X-Kein-Jahrgang-Zugewiesen`).
- **Zähler gegen Listen:** `pendingRequests`, `pendingChallenges`, `newBadges`, `challengeUpdates` (Konfi), `postfach.ungelesen` = Postfach-Liste; `je-organisation` rechnet die Rolle je Gemeinde und das Postfach einmal (Ausnahme BF-11).
- **Postfach-Aufräumen:** Mitteilungen sterben mit Antrag, Termin, Challenge, Abzeichen und Jahrgang (`postfachAufraeumen.js`, `mitteilungenAufraeumen.test.js`).
- **Mitgliedschaftsende über den Org-Admin:** Zuweisungen und alle Chat-Plätze der Gemeinde weg (`users.js:666-694`, seit 27.09.).
- **E-Mails:** Passwort-Link und Einladung nur an die eigene Adresse, Matrix-Mail nur an die anfragende Person mit Jahrgangsprüfung (`jahrgaenge.js:692-699`).
- **Bekannt, weiterhin offen:** `GET /chat/rooms` zählt eigene Nachrichten als ungelesen, `badge-counts` nicht (Bericht 26.09., BF-10) — unverändert (`chat.js:924-931`).

## Nicht geprüft

- **Produktion:** Kein Zugriff. Nachzumessen wären: Zahl der Admins mit Zuweisung auf einzelne Jahrgänge gegenüber Admins ohne Zuweisung (Reichweite von BF-01/02/10); Gemeinden ohne Stamm-Org-Admin (`SELECT o.id FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id WHERE u.organization_id=o.id AND r.name='org_admin')` — trifft BF-09); Zuweisungen mit `can_view = false` (BF-16); Leitungs-Mitteilungen, deren Konfi es nicht mehr gibt (BF-13: `notifications` vom Typ `event_opt_out`/`event_unregistration`/`new_konfi_registration` gegen `users`).
- **Frontend** über `BadgeContext` und `je-organisation` hinaus: Ziele der Push-Navigation, Anzeige der Postfach-Einträge, Verhalten der Store-Apps 2.2.x bei den empfohlenen Änderungen (die Empfehlungen ändern keine Antwortform, nur Empfängerkreise).
- **Zustellung** auf echten Geräten (Kanäle, Stummschaltung je Gruppe über `pushGruppenAuswahl.test.js` hinaus), SMTP-Versand.
- **Rückblick-Inhalte**, Material-Dateien, Lastverhalten der Empfängerlisten.
