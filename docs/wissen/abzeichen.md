# Abzeichen-System (Badges)

Stand: 24.08.2026. Vollprüfung von Backend-Wertung, Anlege-Formular und allen
drei Ansichten (Leitung, Teamer, Konfi). Jede Aussage ist mit Datei:Zeile
belegt; Zeilennummern beziehen sich auf den Stand von Commit 197f5e66.

## Überblick

### Tabellen (backend/tests/schema/prod-schema.sql)

| Tabelle | Zweck | Wichtige Spalten |
|---|---|---|
| `custom_badges` (Zeile 657) | Badge-Definitionen | `criteria_type` (text), `criteria_value` (bigint), `criteria_extra` (text, JSON), `is_active`, `is_hidden`, `target_role` ('konfi'/'teamer'), `organization_id`, `color` |
| `user_badges` (Zeile 1147) | Vergebene Badges | `user_id`, `badge_id`, `awarded_date`, `organization_id`, `seen` |

Doppelvergabe ist per DB verhindert: `CREATE UNIQUE INDEX uq_user_badges_user_badge ON user_badges (user_id, badge_id)` (prod-schema.sql:3880).

### Ablauf

1. **Anlegen** (nur Leitung): `BadgeManagementModal.tsx` -> `POST /api/admin/badges`
   (badges.js:734, `requireAdmin`). Zielgruppe (`target_role`) ist nur beim
   Anlegen wählbar (Modal:671 "nur bei neuem Badge"); das Backend-`PUT`
   aktualisiert `target_role` konsequenterweise nicht (badges.js:766-780).
2. **Wertung**: `checkAndAwardBadges(db, userId)` (badges.js:101) verzweigt nach
   Rolle: Konfi-Branch (badges.js:120-336) bzw. `checkAndAwardTeamerBadges`
   (badges.js:341-580). Geladen werden nur aktive Badges der eigenen Organisation
   mit passender `target_role` (badges.js:147 bzw. 344).
3. **Vergabe**: `insertBadgesAndNotify` (badges.js:601-643) legt `user_badges`-
   Zeilen an, schreibt eine In-App-Notification, sendet Push
   (`sendBadgeEarnedToKonfi`, pushService.js:408 — arbeitet über das generische
   `sendToUser`, funktioniert also auch für Teamer) und ein Live-Update
   (`sendToUserByRole`, badges.js:641).
4. **Anzeige**:
   - Konfi: `GET /konfi/badges` (konfi.js:1018) -> `getKonfiBadgeProgress`
     (utils/konfiBadgeProgress.js) -> `KonfiBadgesPage.tsx` -> gemeinsame
     `konfi/views/BadgesView.tsx`; Dashboard über `KonfiDashboardPage.tsx:180-195`.
   - Teamer: `GET /teamer/badges` (teamer.js:267, eigene Progress-Berechnung
     teamer.js:286-500) -> `TeamerBadgesPage.tsx` -> dieselbe `BadgesView`;
     Dashboard `TeamerDashboardPage.tsx:360-379`.
   - Leitung: Katalog `GET /admin/badges` (badges.js:675) ->
     `AdminBadgesPage.tsx` / `admin/BadgesView.tsx`; Konfi-Detail
     `GET /admin/konfis/:id/badges` (konfi-management.js:654, nutzt dieselbe
     `getKonfiBadgeProgress`-Quelle wie die Konfi-App); Teamer-Detail
     `GET /teamer/:userId/badges` (teamer.js:548, nur erreichte Badges).

### Wann läuft die Wertung?

Nach jedem punkterelevanten Ereignis, jeweils NACH Commit:

- Aktivität zuweisen und löschen (konfi-management.js:926, 992)
- Bonuspunkte anlegen und löschen (konfi-management.js:786, 852)
- Antragsgenehmigung (activities.js:545) und Direktzuweisung (activities.js:710)
- Event-Anwesenheit: einzeln (events.js:2915), innerhalb der Punkte-Transaktion
  (events.js:2883), Bulk (events.js:2779), QR-Check-in (events.js:474 für
  Konfis, 490 für Teamer)
- Hintergrundjob alle 5 Minuten für alle Nicht-Admins MIT Push-Token
  (backgroundService.js:31-38, 56-63) — fängt zeitabhängige Typen
  (`streak`, `time_based`, `teamer_year`) ab.

Challenge-Beiträge lösen bewusst KEINEN Badge-Check aus: Challenges sind
"OHNE Punkte, OHNE custom_badges-Eintrag" konzipiert; ihr Abzeichen wird aus
der eigenen Submission abgeleitet (challenges.js:1-18).

Manuelle Vergabe oder Entzug durch die Leitung existiert NICHT: der einzige
INSERT in `user_badges` ist badges.js:603, der einzige DELETE das Löschen des
Badges selbst (badges.js:801) bzw. Nutzer-/Org-Löschung. Einmal verdiente
Badges bleiben auch nach Punktabzug bestehen (getestet: badges.test.js:554).

## Bedingungstypen

Quelle: `CRITERIA_TYPES` (badges.js:12-104), Formular-Sichtbarkeit
(BadgeManagementModal.tsx:112-113, 917-919), Wertung Konfi (badges.js:194-312),
Wertung Teamer (badges.js:389-557).

| Typ | Bedeutung | Felder | Rolle (Formular) | Funktioniert? |
|---|---|---|---|---|
| `total_points` | Summe Gottesdienst+Gemeinde >= Wert (nur aktivierte Punktarten des Jahrgangs) | `criteria_value` | konfi | Ja (badges.js:194-201) |
| `gottesdienst_points` | Gottesdienst-Punkte >= Wert | `criteria_value` | konfi | Ja (badges.js:202-205); bei deaktivierter Punktart unerreichbar und korrekt ausgeblendet (konfiBadgeProgress.js:139-146, 262) |
| `gemeinde_points` | Gemeinde-Punkte >= Wert | `criteria_value` | konfi | Ja (badges.js:206-209) |
| `both_categories` | Beide Punktarten je >= Wert | `criteria_value` | konfi | Ja (badges.js:210-213) |
| `activity_count` | Aktivitäten + besuchte Events >= Wert | `criteria_value` | konfi + teamer | Ja (badges.js:278-281 bzw. 391-394; Teamer zählt nur Teamer-Aktivitäten, aber ALLE anwesenden Events) |
| `event_count` | Besuchte Events >= Wert | `criteria_value` | nur konfi (für Teamer ausgeblendet, Modal:113) | Ja (badges.js:283-286); Teamer-Wertung existiert (badges.js:396-399), ist aber toter Code |
| `mandatory_event_count` | Besuchte Pflicht-Events >= Wert | `criteria_value` | nur konfi | Wertung ja (badges.js:288-298), aber in der Badge-Liste der App UNSICHTBAR — siehe Befund 1 |
| `unique_activities` | Verschiedene Aktivitäten >= Wert | `criteria_value` | konfi + teamer | Ja (badges.js:305-308 bzw. 530-533) |
| `specific_activity` | Bestimmte Aktivität X-mal | `criteria_value`, `criteria_extra.required_activity_name` | konfi + teamer | Ja seit Fix 23.08. (Formular speichert Namen, Modal:285-289; Wertung badges.js:215-224 bzw. 491-503). Altbadges mit `activity_id` werden beim Bearbeiten rückübersetzt (Modal:221-224) |
| `activity_combination` | Kombination von Aktivitäten | `criteria_value`, `criteria_extra.required_activities` (Namen); Teamer-Wertung liest zusätzlich `required_events` | konfi + teamer | Konfi: ja, "mindestens Wert aus Liste" (badges.js:226-231). Teamer: andere Semantik, Wert wird ignoriert — Befund 7 |
| `category_activities` | Aktivitäten + Events aus Kategorie >= Wert | `criteria_value`, `criteria_extra.required_category` (Name) | konfi + teamer | Ja (badges.js:233-255 bzw. 507-528) |
| `time_based` | X Aktivitäten/Events in Y Wochen | `criteria_value`, `criteria_extra.days` (Formular rechnet Wochen*7, Modal:297-300) | nur konfi | Ja (badges.js:257-276); Teamer-Wertung (badges.js:535-556) ist toter Code |
| `streak` | X ISO-Wochen in Folge aktiv | `criteria_value` | nur konfi | Ja (badges.js:310-311, gemeinsame Util streakCalculation.js); Teamer-Wertung (badges.js:401-403) ist toter Code |
| `bonus_points` | Bonuspunkte-SUMME >= Wert | `criteria_value` | konfi | Wertung ja (SUM, badges.js:172, 300-303), aber der Hilfetext behauptet das Gegenteil — Befund 4 |
| `teamer_year` | Aktive Jahre als Teamer:in >= Wert (Jahre mit mind. 1 Teamer-Aktivität/Event ab `users.teamer_since`, Lücken erlaubt) | `criteria_value` | nur teamer (Modal:919) | Ja (badges.js:432-489; Startjahr-Fallback auf älteste Teamer-Aktivität; getestet badges.test.js:581-660) |
| `collection`, `yearly` | Legacy | — | nicht anlegbar | Keine Wertung; nur Anzeige-Reste (konfi/views/BadgesView.tsx:280-281, teamer.js:487-490) |

## Befunde (nach Schwere)

### 1. HOCH: `mandatory_event_count`-Badges sind in der Badge-Liste unsichtbar

- **Was**: Die Kategorien-Liste der gemeinsamen Badge-Ansicht
  (konfi/views/BadgesView.tsx:265-282) kennt 16 Schlüssel — `mandatory_event_count`
  fehlt. Da anschließend `categories.filter(cat => cat.badges.length > 0)`
  (Zeile 284) greift, landet ein solches Badge in KEINER Kategorie und wird
  nie gerendert.
- **Wie äußert es sich**: Konfis verdienen das Badge (Wertung badges.js:288-298
  funktioniert, Push kommt), sehen es aber weder unter "Badges" noch im
  Fortschritt. Es fließt trotzdem in die ERREICHT-Zählung (BadgesView.tsx:322)
  ein — Zahl und sichtbare Kacheln passen nicht zusammen.
- **Fix**: Kategorie-Eintrag `{ key: 'mandatory_event_count', ... }` in
  BadgesView.tsx ergänzen (Icon/Farbe gibt es schon in
  frontend/src/utils/badgeCriteria.ts:43,58).

### 2. MITTEL: Geheime Teamer-Badges werden Teamern vollständig angezeigt

- **Was**: `GET /teamer/badges` filtert `is_hidden` nicht:
  `WHERE cb.organization_id = $2 AND cb.target_role = 'teamer' AND (cb.is_active = true OR ub.id IS NOT NULL)`
  (teamer.js:282). `TeamerBadgesPage.tsx:53-68` reicht alle Badges an die
  gemeinsame `BadgesView` durch, die nicht-verdiente versteckte Badges nicht
  ausblendet (sie kennzeichnet nur verdiente mit Eselsohr, BadgesView.tsx:568).
- **Wie äußert es sich**: Teamer:innen sehen Name, Beschreibung und Fortschritt
  geheimer Badges vor dem Verdienen. Das Teamer-Dashboard macht es richtig
  (nur Zähler und Platzhalter, TeamerDashboardPage.tsx:360-379, 856-899);
  beim Konfi filtert der Server korrekt (konfiBadgeProgress.js:262).
- **Fix**: In teamer.js entweder serverseitig nicht-verdiente `is_hidden`-Badges
  auf Platzhalter reduzieren oder in TeamerBadgesPage analog zum Konfi-Pfad
  filtern (Zählung als "geheim" beibehalten).

### 3. MITTEL: Konfi-Statistik zählt Teamer-Badges mit

- **Was**: Die Gesamt-Statistik in `getKonfiBadgeProgress`
  (konfiBadgeProgress.js:110-116) zählt `custom_badges WHERE is_active = TRUE
  AND organization_id = $1` — OHNE `target_role = 'konfi'`, anders als die
  Badge-Liste selbst (Zeile 34).
- **Wie äußert es sich**: Sobald Teamer-Badges existieren, sind
  `stats.totalVisible`/`totalSecret` beim Konfi zu hoch. Betroffen: die
  PROZENT-Kachel (BadgesView.tsx:324) und die Dashboard-Zahlen "sichtbar/geheim"
  (KonfiDashboardPage.tsx:190-194) — Konfis sehen z.B. geheime Badges
  angekündigt, die sie nie erreichen können. `GET /konfi/badges/stats`
  (konfi.js:1049) filtert dagegen korrekt auf `target_role = 'konfi'`.
- **Fix**: `AND target_role = 'konfi'` in der totalStats-Query ergänzen.

### 4. MITTEL: `bonus_points` — Hilfetext widerspricht der Wertung

- **Was**: Der im Formular angezeigte Hilfetext (badges.js:89-90, gerendert in
  BadgeManagementModal.tsx:971) sagt "es zählt die Anzahl der Vergaben, nicht
  die Punktesumme". Die Wertung rechnet aber mit der SUMME:
  `SELECT COALESCE(SUM(points), 0)` (badges.js:172, Kommentar Zeile 170-171
  erklärt das sogar), ebenso der Fortschritt (konfiBadgeProgress.js:83-84, 229-231).
  Das Wert-Label im Formular sagt wiederum "Punkte" (Modal:609-610).
- **Wie äußert es sich**: Wer nach dem Hilfetext konfiguriert ("Wert 2 =
  2 Vergaben"), bekommt ein Badge, das schon bei einer einzigen Vergabe von
  2 Punkten auslöst. Gleiche Fehlerklasse wie der 23.08.-Befund, nur auf
  Textebene.
- **Fix**: Hilfetext und `description` (badges.js:89) auf "Summe der
  Bonuspunkte" korrigieren.

### 5. MITTEL: Admin-Liste zeigt bei Aktivitäts-Badges keine Details mehr

- **Was**: `getCriteriaDetail` in admin/BadgesView.tsx liest
  `extra.activity_id` (Zeile 183-188) und `extra.activity_ids` (Zeile 190-199).
  Seit dem Fix vom 23.08. speichert das Formular aber
  `required_activity_name`/`required_activities` (Modal:285-289, 302-309).
- **Wie äußert es sich**: Für korrekt gespeicherte Badges zeigt die
  Leitungs-Liste bei `specific_activity` nur "5x" ohne Aktivitätsnamen und bei
  `activity_combination` gar kein Detail (`return null`). Paradox: Nur die
  ALTEN, kaputten Badges (mit `activity_id`) werden schön angezeigt. Gleiche
  Fehlerklasse (Schlüssel-Mismatch), aber reine Anzeige — Wertung stimmt.
- **Fix**: In getCriteriaDetail zuerst `required_activity_name`/
  `required_activities` lesen, IDs nur als Fallback für Altbadges.

### 6. MITTEL: Deaktiviertes Badge verschwindet beim Konfi aus "Erreicht"

- **Was**: Die Konfi-Badge-Query verlangt `cb.is_active = TRUE`
  (konfiBadgeProgress.js:34) — auch für bereits VERDIENTE Badges. Die
  Teamer-Route behält verdiente Badges explizit:
  `(cb.is_active = true OR ub.id IS NOT NULL)` (teamer.js:282).
- **Wie äußert es sich**: Deaktiviert die Leitung ein Badge (z.B. Saisonende),
  verlieren Konfis es aus ihrer Ansicht, obwohl der `user_badges`-Eintrag
  bleibt. Zähl-Endpunkte zählen ihn weiter mit (Dashboard-badgeCount
  konfi.js:101-102, Profil-Stats konfi.js:413-416) — die Zahlen widersprechen
  der sichtbaren Liste.
- **Fix**: In konfiBadgeProgress.js dieselbe OR-Bedingung wie in teamer.js:282
  verwenden.

### 7. MITTEL: `activity_combination` hat für Teamer eine andere Semantik als dokumentiert

- **Was**: Konfi-Wertung: mindestens `criteria_value` Aktivitäten aus der Liste
  (badges.js:226-231). Teamer-Wertung: ALLE `required_activities` UND alle
  `required_events` müssen erfüllt sein, `criteria_value` wird ignoriert
  (badges.js:405-429). Der Hilfetext (badges.js:74) und das Wert-Feld im
  Formular beschreiben die Konfi-Semantik.
- **Wie äußert es sich**: Legt die Leitung ein Teamer-Kombi-Badge mit z.B.
  Wert 2 bei 5 Aktivitäten an, erwartet sie "2 von 5" — vergeben wird erst bei
  5 von 5. Der Teamer-Fortschritt (teamer.js:456-467) misst gegen
  `criteria_value` und kann daher 100% anzeigen, ohne dass das Badge kommt —
  exakt der Progress-Wertungs-Drift, vor dem der Konsistenz-Vertrag in
  konfiBadgeProgress.js:10-12 warnt.
- **Nebenbefund**: `required_events` (badges.js:415-425) kann das Formular gar
  nicht erzeugen (handleSave speichert nur `required_activities`,
  Modal:302-309) — toter Code. Zudem gibt `badgeEarned = allMet &&
  (criteria.required_activities || ...)` (badges.js:428) ein Array statt
  Boolean zurück (funktional truthy, aber unsauber).
- **Fix**: Teamer-Wertung auf die Konfi-Semantik (matchCount >= Wert)
  vereinheitlichen oder Hilfetext/Progress an die Alles-oder-nichts-Semantik
  anpassen.

### 8. NIEDRIG: Namens-Kopplung — Umbenennen entkoppelt Badges still

- **Was**: `specific_activity`, `activity_combination` und
  `category_activities` speichern Aktivitäts- bzw. Kategorie-NAMEN
  (Modal:285-309, 486; Wertung joint über `a.name`/`c.name`,
  badges.js:216-218, 240-250).
- **Wie äußert es sich**: Wird eine Aktivität oder Kategorie umbenannt, findet
  die Wertung nichts mehr — das Badge wird kommentarlos unerreichbar; bereits
  gezählter Fortschritt fällt auf 0. Kein Hinweis im Aktivitäten-Editor.
- **Fix (längerfristig)**: IDs speichern und die Wertung auf IDs umstellen
  (der umgekehrte Weg des 23.08.-Fixes), oder beim Umbenennen die
  `criteria_extra` aller betroffenen Badges mitziehen.

### 9. NIEDRIG: Hintergrund-Check nur für User mit Push-Token

- **Was**: `updateAllUserBadges` lädt die Kandidaten aus `push_tokens`
  (backgroundService.js:56-63).
- **Wie äußert es sich**: User ohne Push-Token (Push abgelehnt, nur Web) werden
  vom 5-Minuten-Check nie erfasst. Rein zeitgetriebene Vergaben — vor allem
  `teamer_year` beim Jahreswechsel — kommen bei ihnen erst mit dem nächsten
  Ereignis (Aktivität/Event/Anwesenheit) an, im Extremfall nie.
- **Fix**: Kandidaten aus `users` statt `push_tokens` ziehen (Badge-Check vom
  App-Icon-Badge-Update trennen).

### 10. NIEDRIG: Teamer-"gesehen"-Endpunkte sind tot, `seen` bleibt false

- **Was**: `GET /teamer/badges/unseen` (teamer.js:508) und
  `PUT /teamer/badges/mark-seen` (teamer.js:526) werden im Frontend nirgends
  aufgerufen (einziger Treffer für mark-seen: KonfiBadgesPage.tsx:87,93 —
  der Konfi-Pfad, dort als POST). Die "neu"-Markierung im Teamer-Dashboard
  nutzt stattdessen `awarded_date` (isRecent, TeamerDashboardPage.tsx:378).
- **Wie äußert es sich**: Aktuell kein sichtbarer Fehler, aber `seen` ist für
  Teamer dauerhaft false — sobald jemand die Unseen-Zählung anbindet, zeigt
  sie alles als ungesehen. Zudem Methoden-Inkonsistenz (POST beim Konfi,
  PUT beim Teamer).
- **Fix**: Entweder anbinden (TeamerBadgesPage analog KonfiBadgesPage) oder
  Endpunkte entfernen.

### 11. NIEDRIG: PUT validiert `criteria_value` nicht; Wert 0 ist erlaubt

- **Was**: `validateCreateBadge` prüft `criteria_value` als Int >= 0
  (badges.js:648-654), `validateUpdateBadge` prüft ihn gar nicht
  (badges.js:656-662). Fehlt der Wert im PUT-Body, wird NULL gespeichert
  (badges.js:772-776); in der Wertung ist `x >= null` in JavaScript wahr —
  das Badge ginge an alle. Auch Wert 0 (Create erlaubt min: 0) löst bei allen
  Zähl-Kriterien sofort aus.
- **Einordnung**: Über die App nicht auslösbar (das Formular sendet den Wert
  immer mit) — "vermutet, nicht in Produktion nachgewiesen"; die
  API-Härtungslücke selbst ist verifiziert.
- **Fix**: Validierung aus Create in Update übernehmen, min auf 1 setzen.

### 12. NIEDRIG: Fehlende Auswahl beim Anlegen wird nicht abgefangen

- **Was**: Speichert die Leitung ein `specific_activity`-/
  `activity_combination`-Badge OHNE Aktivitätsauswahl, bleibt `criteriaExtra`
  leer (Modal handleSave:276-311 setzt nur bei Treffern); die Wertung prüft
  `if (criteria.required_activity_name)` bzw. `if (criteria.required_activities)`
  (badges.js:216, 227) und bleibt sonst still false. Gleiches gilt für
  `category_activities` ohne Kategorie und `time_based` ohne Wochenangabe
  (dort greift allerdings der Slider-Default 4, Modal:522).
- **Wie äußert es sich**: Ein nie erreichbares Badge ohne jede Warnung.
- **Fix**: Pflichtfeld-Validierung in handleSave je nach criteria_type.

### 13. INFO: Kleinere Inkonsistenzen ohne akute Wirkung

- `teamer_year`-Wertung filtert die Aktivitäts-Queries nicht auf
  `organization_id` (badges.js:449-455, 468-475), die Progress-Query in
  teamer.js:314-320 schon. Praktisch harmlos, da ein User genau einer
  Organisation angehört — aber inkonsistent zum Rest.
- `computeCurrentStreak` (streakCalculation.js:48-79) endet bei der NEUESTEN
  aktiven Woche, nicht bei "heute": eine vor Monaten gerissene Serie wird im
  Fortschritt weiter als aktueller Streak angezeigt. Für die Vergabe egal
  (der 5-Minuten-Check hätte damals vergeben), für die Anzeige leicht
  irreführend.
- Konfi-`specific_activity` zählt über den Aktivitätsnamen (badges.js:216-218)
  ohne `target_role`-Filter; teilen sich eine Konfi- und eine Teamer-Aktivität
  denselben Namen, werden sie zusammengezählt.
- Teamer-Dashboard-Endpunkt zählt `total_count` inklusive versteckter Badges
  (teamer.js:893-897), die Badge-Seite trennt sichtbar/geheim — unterschiedliche
  Bezugsgrößen je nach Ansicht.
- `sort_order` existiert im Schema (prod-schema.sql:672), wird aber weder vom
  Formular gesetzt noch von einer Sortierung benutzt (Liste sortiert nach
  `created_at` bzw. `criteria_type`/`name`).
- Zeitzonen: `time_based` rechnet mit Millisekunden-Cutoff (badges.js:270-273),
  `streak` mit ISO-Wochen aus Server-Lokalzeit (streakCalculation.js:15-21).
  Bei Wochen-Granularität kein praktisches Problem gefunden; Grenzfälle um
  Mitternacht/Jahreswechsel verschieben höchstens um einen Tag innerhalb
  derselben Woche.

## Geprüft und in Ordnung

- **Fix vom 23.08. ist wirksam**: Das Formular speichert Namen
  (`required_activity_name`/`required_activities`, Modal:276-311), die Wertung
  liest genau diese Schlüssel (badges.js:216, 227), und beim Bearbeiten alter
  Badges werden Namen zurück in IDs übersetzt, damit Speichern nichts löscht
  (Modal:216-230). Einzige Nachzügler: Anzeige in der Admin-Liste (Befund 5)
  und Hilfetext bonus_points (Befund 4).
- **String-Konkatenations-Bug behoben**: Punkte werden einmalig geparst
  (badges.js:133-134, konfiBadgeProgress.js:125-126, 132); Test
  badges.test.js:414 deckt ihn ab.
- **Keine Doppelvergabe**: `alreadyEarned`-Check (badges.js:153, 186 bzw. 350, 382) plus
  UNIQUE-Index (prod-schema.sql:3880); Test badges.test.js:446. Bei einem
  Race schlägt der zweite INSERT fehl statt zu duplizieren.
- **Auslösung vollständig für Punkte-Ereignisse**: Aktivität (zuweisen,
  löschen, Antrag), Bonuspunkte (anlegen, löschen), Event-Anwesenheit
  (einzeln, Bulk, QR) — jeweils nach Commit, Fehler im Badge-Check brechen
  den Request nicht ab. Challenge-Beiträge sind bewusst außen vor.
- **Benachrichtigung bei Vergabe**: In-App-Notification, Push und Live-Update
  in insertBadgesAndNotify (badges.js:608-641); `sendToUserByRole` erreicht
  auch Teamer-Sockets, `sendToUser` im Push-Service ist rollenneutral.
- **Organisationsgrenze**: Alle Lese-/Schreibrouten filtern auf
  `organization_id` (badges.js:147, 344, 675-699, 766-780, 796-812;
  teamer.js:282, 554-576; konfi-management.js:660-668). Der DELETE löscht
  `user_badges` zwar zunächst ohne Org-Filter (badges.js:801), rollt aber
  zurück, wenn das Badge nicht zur eigenen Org gehört (badges.js:806-809) —
  Fremdlöschung ist damit nicht möglich. Getestet: badges.test.js:61, 103,
  203, 268.
- **Rechte**: Lesen (`GET /admin/badges`, `/criteria-types`) mit
  `requireTeamer`, Schreiben (POST/PUT/DELETE) mit `requireAdmin`
  (badges.js:671-796; rbac.js:273-274). Konfis bekommen 403
  (badges.test.js:52); Teamer dürfen den Katalog sehen (badges.test.js:41) —
  bewusste Entscheidung ("Teamer darf ansehen, Admin darf bearbeiten",
  badges.js:646). Konfi-/Teamer-Detailrouten prüfen Rolle und Org des
  Ziel-Users (konfi-management.js:660-668, teamer.js:553-563).
- **Konsistenz Wertung vs. Fortschritt (Konfi)**: Eine gemeinsame Quelle
  `getKonfiBadgeProgress` für Konfi-App UND Admin-Detail
  (konfi-management.js:651-672); Event-Zählregel zentral in
  `badgeEventRule.js` (Konfis: nur freiwillige, bestätigte Events; Teamer:
  alle bestätigten), Streak zentral in `streakCalculation.js`.
  `mandatory_event_count` zählt in Wertung und Progress byte-identisch
  (badges.js:290-294, konfiBadgeProgress.js:78-81, 185-188); Tests
  badges.test.js:477-554.
- **Versteckte Badges beim Konfi**: Serverseitig aus `available` gefiltert
  (konfiBadgeProgress.js:262), nur Zähler werden gezeigt; verdiente geheime
  Badges erscheinen mit Kennzeichnung (BadgesView.tsx:568). Konfi-Dashboard
  zeigt geheime nur als Platzhalter (KonfiDashboardPage.tsx:190-194).
- **teamer_year**: Startjahr aus `users.teamer_since` mit Fallback auf die
  älteste Teamer-Aktivität, Lücken-Jahre erlaubt, Jahre vor der Beförderung
  zählen nicht — Wertung (badges.js:432-489) und Progress (teamer.js:396-431)
  konsistent; Tests badges.test.js:581-660.
- **Beförderte Konfis behalten ihre Badges**: Beim Konfi-zu-Teamer-Wechsel
  bleiben `user_badges` bestehen (konfi-management.js:1103); das Teamer-Profil
  zeigt sie unter `konfi_data.badges` (teamer.js:80-92).
- **Badge löschen räumt auf**: DELETE entfernt `user_badges`-Einträge
  transaktional mit (badges.js:796-812; Test badges.test.js:239).
- **`target_role` unveränderlich nach Anlage**: Formular bietet die Wahl nur
  im Neu-Modus (Modal:671), Backend-PUT schreibt das Feld nicht — konsistent.
