# Chat-Löschlogiken: Vollständige Evaluation

**Auftrag:** Alle Löschlogiken im Chat-System prüfen — Raum löschen, Nachricht
löschen, Kaskaden aus Event/Jahrgang/Person/Organisation, Aufräum-Jobs.
Leitfrage: "Wenn ich als Admin einen Chat lösche — ist er dann bei allen weg?"
Reine Analyse, keine Änderungen.
**Datum:** 26.08.2026
**Geprüfter Commit:** `109d4e0` (main)
**Urteil in einem Satz:** Das Raum-Löschen ist ein sauberes, hartes Löschen für
alle Beteiligten inklusive Dateien — die Schwächen liegen daneben: Anhänge
"gelöschter" Einzelnachrichten bleiben abrufbar, Personen- und
Organisations-Löschung lassen Chat-Dateien auf der Platte zurück, und für
beide Lösch-Endpunkte existiert kein einziger Test.

---

## Antwort auf die Leitfrage

**Ja — löscht ein Admin einen Chat-Raum, ist er bei allen weg, endgültig.**
`DELETE /api/chat/rooms/:roomId` (`backend/routes/chat.js:2157`) ist ein hartes
DELETE, kein Ausblenden: In einer Transaktion werden Umfrage-Stimmen, Umfragen,
Lesestatus, Nachrichten, Teilnehmer und der Raum selbst entfernt
(`chat.js:2213–2238`), die Dateianhänge werden anschließend vom Datenträger
gelöscht (`chat.js:2209`, `2244–2252`), und alle bisherigen Teilnehmer:innen
bekommen die aktualisierte Raumliste sofort per Socket gepusht
(`chat.js:2196–2199`, `2262`). Löschen dürfen nur Nutzer:innen mit
`type === 'admin'` — das sind die Rollen admin, org_admin und super_admin
(`chat.js:2163`; Rollen-Mapping `backend/middleware/rbac.js:208`); Teamer und
Konfis bekommen 403. Zwei Sonderfälle: Jahrgangs-Chats lassen sich nur über
das Löschen des Jahrgangs entfernen (`chat.js:2186–2190`), und der Team-Chat
wird nach dem Löschen vom automatischen Sync leer neu angelegt (Befund 4).

---

## Einzelbefunde (nach Schwere)

### Befund 1 (mittel): Anhänge "gelöschter" Nachrichten bleiben abrufbar, der Inhalt bleibt in der Datenbank

**Was ist:** Das Löschen einer Einzelnachricht ist ein Soft-Delete — es wird
nur `deleted_at` gesetzt (`chat.js:2122`), der Inhalt bleibt vollständig in
der DB. Die Nachrichtenliste maskiert zwar `content` ("Diese Nachricht wurde
gelöscht", `chat.js:806–813`), liefert aber über `m.*` weiterhin `file_path`
und `file_name` der gelöschten Nachricht aus (`chat.js:796`). Die
Datei-Auslieferung `GET /chat/files/:filename` prüft `deleted_at` überhaupt
nicht (`chat.js:1652–1668`) — jedes Raum-Mitglied kann den Anhang einer
gelöschten Nachricht weiter herunterladen. Auch der Export blendet nur den
Text aus (`chat.js:1230–1237`).

**Was wäre zu erwarten:** Die App fragt vor dem Löschen "Diese Nachricht
unwiderruflich löschen?" (`frontend/src/components/chat/ChatRoom.tsx:953–954`).
Nutzer:innen erwarten danach, dass insbesondere ein versehentlich geschicktes
Foto weg ist.

**Folge:** Ein peinliches oder problematisches Bild ist nach dem "Löschen"
weder von der Platte entfernt noch aus der DB — und für alle Raum-Mitglieder,
die die URL kennen (sie stand im API-Response), weiter abrufbar.

### Befund 2 (mittel): Personen- und Organisations-Löschung lassen Chat-Dateien als Waisen auf der Platte

**Was ist:** Beim Löschen einer Person werden deren Nachrichten hart entfernt
(`backend/utils/konfiDeletion.js:59` für Konfi-/Selbst-/Auto-Löschung;
`backend/routes/users.js:462` für Admin/Teamer), aber die `file_path`-Werte
der Chat-Anhänge werden vorher NICHT eingesammelt — eingesammelt werden nur
Nachweisfotos und Challenge-Dateien (`konfiDeletion.js:34–48`,
`users.js:484–501`). Gleiches bei der Organisations-Löschung: Sie löscht alle
Chat-DB-Daten (`backend/routes/organizations.js:664–670`), sammelt aber nur
Challenge-Dateien ein (`organizations.js:702`). Zum Vergleich: Raum-, Event-
und Jahrgang-Löschung machen es richtig (`chat.js:2209/2244`,
`backend/routes/events.js:1499–1546`, `backend/routes/jahrgaenge.js:246–280`).

**Was wäre zu erwarten:** Dieselbe Datei-Aufräumlogik wie bei den drei
anderen Pfaden.

**Folge:** Nach einer Konto-Löschung (auch DSGVO-Selbstlöschung über
`auth.js:354`) liegen die hochgeladenen Chat-Bilder der Person weiter in
`uploads/chat/` — nicht mehr abrufbar (die Auslieferung läuft über die
gelöschte DB-Zeile, `chat.js:1652–1657`), aber physisch vorhanden. Das ist
dieselbe Fehlerklasse, die bei Challenge-Dateien am 04.08.2026 bewusst
behoben wurde (Kommentar `konfiDeletion.js:40–43`).

### Befund 3 (mittel): Admins dürfen fremde Direktchats löschen, die sie nicht lesen dürfen

**Was ist:** Der Raum-Delete prüft nur Rolle und Organisation
(`chat.js:2163`, `2170`) — ausdrücklich: "Direct chats can be deleted by
admins (no restrictions)" (`chat.js:2192`). Das LESEN fremder Direktchats ist
dagegen gesperrt (gleiche Regel in `backend/utils/chatRoomAccess.js:55–58`
und in `darfRaumOeffnen` der HTTP-Routen). Beim Nachrichten-Löschen ist es
konsistent gelöst: Fremde Nachrichten nur, wenn man den Raum öffnen darf
(`chat.js:2110–2118`).

**Was wäre zu erwarten:** Wer ein privates Zweiergespräch nicht einsehen
darf, sollte es auch nicht samt Verlauf vernichten können — oder die
Ausnahme ist eine bewusste Moderations-Entscheidung und gehört dokumentiert.

**Folge:** Jeder Admin der Organisation kann jeden Direktchat (z.B. zwischen
einem anderen Admin und einem Konfi) mit `?force=true` restlos löschen —
für beide Beteiligten, ohne je eine Zeile gelesen zu haben.

### Befund 4 (mittel): Team-Chat ist per API löschbar und ersteht danach leer wieder auf

**Was ist:** Gesperrt ist im Raum-Delete nur `type === 'jahrgang'`
(`chat.js:2186–2190`). Der automatische Team-Chat hat `type = 'admin'` und
`is_team_chat = true` (`backend/utils/teamChat.js:35–40`) — er ist per API
löschbar. Der nächste `GET /chat/rooms` mit fälligem Sync legt ihn neu an
(`chat.js:585`, `626`; `teamChat.js:30–42`), leer. Die UI bietet das Löschen
nur für `direct`/`group` an (`frontend/src/components/chat/ChatOverview.tsx:518`),
schützt also den Normalfall — die API nicht.

**Was wäre zu erwarten:** Gleiches Muster wie beim Jahrgangs-Chat: direkte
Löschung ablehnen, weil der Raum automatisch verwaltet wird.

**Folge:** Der gesamte Team-Verlauf ist weg, der Raum taucht aber wieder auf —
für die Nutzer:innen sieht das wie ein "geleerter" Chat aus, nicht wie ein
gelöschter; die Ursache (wer hat gelöscht?) ist nicht mehr erkennbar.

### Befund 5 (niedrig): Personen-Löschung reißt deren Nachrichten ersatzlos aus fremden Verläufen

**Was ist:** Beim Löschen einer Person werden ALLE ihre Nachrichten hart
gelöscht (`konfiDeletion.js:59`, `users.js:462`) — ohne Platzhalter.
Antworten anderer auf diese Nachrichten verlieren per `reply_to ... ON DELETE
SET NULL` ihren Bezug (`backend/migrations/102_chat_rooms_cascade.sql:49–60`).

**Was wäre zu erwarten:** Konsistenz mit dem manuellen Löschen, das den
Platzhalter "Diese Nachricht wurde gelöscht" stehen lässt (`chat.js:807`).
(Hartes Löschen ist DSGVO-seitig vertretbar — dann bleibt es aber eine
bewusste Abweichung.)

**Folge:** In Gruppen- und Jahrgangschats entstehen für die Verbleibenden
kommentarlose Lücken; Zitate zeigen ins Leere.

### Befund 6 (niedrig): Konfis dürfen eigene Nachrichten per API löschen, sehen aber keinen Knopf

**Was ist:** Das Backend erlaubt jedem das Löschen der EIGENEN Nachricht
(`chat.js:2114`). Die UI zeigt den Papierkorb nur für admin/org_admin (jede
Nachricht) und Teamer (eigene) — Konfis bewusst gar nicht
(`frontend/src/components/chat/MessageBubble.tsx:749–757`).

**Folge:** Keine Sicherheitslücke, aber UI und API sagen Verschiedenes;
sollte die UI-Entscheidung fachlich gelten, wäre die API strenger zu fassen
(oder umgekehrt der Knopf für eigene Nachrichten auch Konfis zu geben).

### Befund 7 (niedrig): Lösch-Warnung zählt soft-gelöschte Nachrichten nicht

**Was ist:** Die 409-Rückfrage ("Chat hat Nachrichten") zählt nur Nachrichten
mit `deleted_at IS NULL` (`chat.js:2176`). Ein Raum, in dem alle Nachrichten
soft-gelöscht sind, wird ohne Rückfrage entfernt. Die Datei-Aufräumung ist
davon unabhängig korrekt — sie sammelt OHNE `deleted_at`-Filter
(`chat.js:2209`).

**Folge:** Gering; die Rückfrage fehlt genau dann, wenn nur noch
Platzhalter im Raum stehen.

### Befund 8 (Hinweis, kein Fehler): Event-Chats sind regulär löschbar und werden NICHT automatisch neu angelegt

Event-Chats sind `type = 'group'` mit `event_id` (`events.js:3044`) — in der
UI löschbar (`ChatOverview.tsx:518`), im Backend nicht gesperrt. Anders als
Jahrgangs- und Team-Chat legt sie kein Sync neu an: `eventChat.js` und
`syncEventChat` verwalten nur die MITGLIEDSCHAFT in bestehenden Räumen
(`backend/utils/eventChat.js:44–46`, `88–107`); das Anlegen bleibt eine
bewusste Handlung der Leitung (`events.js:3022`). Konsistent.

---

## Kaskaden aus anderen Bereichen (alle geprüft)

| Auslöser | Verhalten | Beleg |
|---|---|---|
| **Event löschen** | 409-Warnung, wenn der Event-Chat Nachrichten hat (`error_code: event_has_chat`); mit `force` prozedurales Löschen von Votes/Polls/Read-Status/Nachrichten/Teilnehmern/Räumen inkl. Datei-Unlink | `events.js:1480–1546` |
| | DB-Sicherheitsnetz: `chat_rooms.event_id` → `ON DELETE CASCADE` | `migrations/114_add_chat_fks.sql:16–18` |
| **Jahrgang löschen** | Blockiert, solange aktive Konfis zugeordnet sind; 409+`force` bei Chat-Nachrichten; löscht dann Jahrgangs-Chat inkl. Dateien. Direktes Löschen des Jahrgangs-Chats über die Chat-API ist gesperrt | `jahrgaenge.js:220–290`; `chat.js:2186–2190` |
| | Solange der Jahrgang existiert, legt der Sync einen fehlenden Jahrgangs-Chat neu an — nach der Jahrgang-Löschung nicht mehr (Jahrgang weg → Sync bricht ab) | `backend/utils/jahrgangChat.js:34–53` |
| **Konfi löschen** (Admin/Selbst/Auto) | Hart: Teilnahmen, Lesestatus, Reaktionen, Nachrichten, Poll-Stimmen; `chat_rooms.created_by` wird genullt. Direkträume mit verbliebenem Partner bleiben bewusst stehen | `konfiDeletion.js:50–63`, `92`; Aufrufer `konfi-management.js:412`, `auth.js:354`, `backgroundService.js:1110`; Entscheidung `migrations/111_cleanup_orphaned_direct_rooms.sql` |
| **Admin/Teamer löschen** (users.js) | Wie oben, zusätzlich Aufräumen komplett verwaister Direkträume | `users.js:432`, `460–472` |
| **Organisation löschen** (nur super_admin) | Hartes Löschen der gesamten Chat-Struktur in FK-Reihenfolge — aber ohne Datei-Cleanup (Befund 2) | `organizations.js:636`, `664–670` |

**FK-Netz (Migrationen):** `chat_messages.room_id` CASCADE,
`chat_participants.room_id` CASCADE, `chat_messages.reply_to` SET NULL,
`chat_polls.message_id` CASCADE, `chat_poll_votes.poll_id` CASCADE
(`migrations/102_chat_rooms_cascade.sql`); `chat_messages.user_id` CASCADE,
`chat_participants.user_id` CASCADE, `chat_rooms.event_id` CASCADE
(`migrations/114_add_chat_fks.sql`); `chat_read_status.room_id` CASCADE
(`migrations/064_add_missing_fks.sql:103–111`);
`chat_message_reactions.message_id/user_id` beide CASCADE (laut Prod-Dump
`tests/schema/prod-schema.sql:4020–4032`; Dump am 24.08.2026 als
deckungsgleich nachgemessen). Damit hinterlässt keiner der Löschpfade
verwaiste DB-Zeilen — die Waisen liegen nur auf dem Dateisystem (Befund 2).

## Aufräum-Jobs / Cron

Es gibt **kein** zeitgesteuertes Löschen von Chat-Daten. Die einzigen
Lösch-Automatiken in `backend/services/backgroundService.js` betreffen
Push-Tokens (`:610–622`) und die Konfi-Auto-Löschung (`:1086–1110`), die über
`deleteKonfiCascade` läuft. Alte Nachrichten und Räume bleiben unbegrenzt.

## Was ist NICHT durch Tests abgesichert

- **`DELETE /api/chat/rooms/:roomId`: kein einziger Test.**
  `backend/tests/routes/chat.test.js` enthält kein `describe` dazu — weder
  403 für Teamer/Konfi, noch 409/`force`, noch Jahrgangs-Sperre, noch die
  Lösch-Kaskade oder das Datei-Aufräumen.
- **`DELETE /api/chat/messages/:messageId`: kein Test.** Weder "eigene
  Nachricht ja", noch "fremde als Teamer nein", noch "fremder Direktchat als
  Admin nein" (die Entscheidung vom 23.08. ist ungetestet), noch der
  Soft-Delete-Effekt.
- **Event- und Jahrgang-Löschung:** Die Chat-Kaskaden sind ungetestet — in
  `events.test.js` und `jahrgaenge.test.js` kommt "chat" nicht vor.
- Bereits abgesichert: Export-Platzhalter für gelöschte Nachrichten
  (`chat.test.js:622`), Teilnehmer entfernen (`chat.test.js:705–739`),
  Org-Löschung räumt `chat_rooms`/`chat_messages` auf
  (`organizations.test.js:570–573`), Team-Chat-Mitgliedschaft
  (`users.test.js:134–147`).
