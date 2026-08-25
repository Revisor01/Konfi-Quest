> **ERLEDIGT** am 25.08.2026: Reglergrenze durch `4d7f520b`, die sechs
> kaputten Datensätze per SQL in Produktion (Abzeichen 36 auf
> "Seniorinnen", Kategorie "Jugend" angelegt, 40/41/43/50 deaktiviert).
> Offen bleibt: Kategorie "Jugend" hat 0 Aktivitäten — Abzeichen 35 ist
> erst erreichbar, wenn dort Aktivitäten zugeordnet sind.

# Abzeichen-Bedingungstypen: systematischer Durchgang

Stand: 25.08.2026, Code-Stand `a64ac8b4` (main, sauber).
Produktionsdatenbank gelesen über `konfi_quest-postgres-1` (nur SELECT).
Der Containername aus dem Auftrag (`konfi-quest-db-1`) existiert nicht mehr.

Vorlage: `docs/wissen/abzeichen.md` (Stand 24.08., 13 Befunde). Dieser Bericht
prüft die dort offenen Punkte nach UND geht alle 15 Bedingungstypen einzeln
durch — Konfi-Zweig und Teamer-Zweig getrennt.

---

## Teil 0: Was von den 13 alten Befunden noch offen ist

Vor dem eigentlichen Durchgang gegengeprüft, weil ein Befund, der längst zu
ist, ein falsches Lagebild erzeugt. Ergebnis: **10 von 13 sind behoben**,
verteilt auf `a372878e`, `7f70cd7b` und `9d3eeeb3`.

| Alt | Thema | Status | Beleg |
|---|---|---|---|
| 1 | `mandatory_event_count` unsichtbar | BEHOBEN | Kategorie ergänzt, konfi/views/BadgesView.tsx:283 |
| 2 | Geheime Teamer-Abzeichen verraten | BEHOBEN | teamer.js:494 `sichtbareBadges`-Filter + Header-Zähler |
| 3 | Konfi-Statistik zählt Teamer-Abzeichen | BEHOBEN | konfiBadgeProgress.js:119 `AND target_role = 'konfi'` |
| 4 | `bonus_points` Hilfetext falsch | BEHOBEN | badges.js:92 Text auf Summe korrigiert |
| 5 | Admin-Liste zeigt keine Details | BEHOBEN | admin/BadgesView.tsx:184-188, Namen zuerst, IDs als Fallback |
| 6 | Deaktiviertes Abzeichen verschwindet | BEHOBEN | konfiBadgeProgress.js:41 `(is_active OR kb.id IS NOT NULL)` |
| 7 | `activity_combination` Teamer-Semantik | BEHOBEN | badges.js:408-436, jetzt matchCount >= Wert |
| 8 | Namens-Kopplung | **OFFEN, in Produktion wirksam** | siehe Befund A |
| 9 | Hintergrund-Check nur mit Push-Token | BEHOBEN | backgroundService.js:106-120, Kandidaten aus `users` |
| 10 | Teamer-„gesehen" tot | **OFFEN** | teamer.js:524, 542 — kein Frontend-Aufruf |
| 11 | Wert 0 / fehlender Wert | BEHOBEN (`9d3eeeb3`) | badges.js:702, 711 `isInt({min:1})` in Create UND Update |
| 12 | Fehlende Auswahl beim Anlegen | BEHOBEN (`9d3eeeb3`) | badges.js:667-693 `validateCriteriaExtra` |
| 13 | Kleinkram | teils offen | siehe Befunde F, G, H |

---

## Teil 1: Durchgang durch alle 15 Bedingungstypen

Prüfschema je Typ: Soll laut Hilfetext (`CRITERIA_TYPES`, badges.js:12-108) —
Ist in der Wertung — Ist im Fortschritt — stimmen die drei überein?

### Punkte-Typen (nur Konfi)

**1. `total_points`** — Soll: Summe Gottesdienst + Gemeinde >= Wert, nur
aktivierte Punktarten. Wertung badges.js:197-204: addiert je nach
`jahrgangConfig`, ohne Jahrgang `earned = false`. Fortschritt
konfiBadgeProgress.js:196: `gdPoints + gmPoints`, wobei die Punkte oben
(Zeile 127-132) bereits auf 0 gesetzt werden, wenn die Punktart aus ist.
Beides deckungsgleich. Der frühere String-Konkatenationsfehler ist an beiden
Stellen mit `parseInt` geschlossen (badges.js:139-140). **In Ordnung.**

**2. `gottesdienst_points`** — badges.js:205-208, ohne aktivierte Punktart
`false`; als unerreichbar markiert und ausgeblendet
(konfiBadgeProgress.js:178-182, 298). **In Ordnung.**

**3. `gemeinde_points`** — badges.js:209-212, analog. **In Ordnung.**

**4. `both_categories`** — Soll: beide Punktarten je >= Wert. badges.js:213-216
verlangt beide aktiviert und beide >= Wert. Fortschritt:
`Math.min(gdPoints, gmPoints)` (konfiBadgeProgress.js:211) — richtig, denn der
kleinere Wert entscheidet. **In Ordnung.**

**5. `bonus_points`** — Soll laut korrigiertem Hilfetext: SUMME der
Bonuspunkte. Wertung badges.js:178 `COALESCE(SUM(points),0)`, Fortschritt
konfiBadgeProgress.js:92-93 ebenfalls `SUM(points)`. Text, Wertung und
Fortschritt stimmen jetzt überein. **In Ordnung.**

### Zähl-Typen

**6. `activity_count`** — Soll: Aktivitäten + besuchte Events. Konfi
badges.js:284-286: `activityCount + eventCount`, Events nach
`KONFI_BADGE_EVENT_CONDITION` (nur freiwillige, bestätigte). Teamer
badges.js:395-398: nur Teamer-Aktivitäten (`a.target_role='teamer'`), aber
ALLE anwesenden Events — laut badgeEventRule.js:6-10 bewusst so. Fortschritt
Konfi konfiBadgeProgress.js:203, Teamer teamer.js:287-295 identisch.
**In Ordnung**, die Asymmetrie ist dokumentiert und gewollt.

**7. `event_count`** — Konfi badges.js:288-290, Teamer badges.js:400-403.
Im Formular für Teamer ausgeblendet (Modal:113 `TEAMER_HIDDEN_TYPES`), die
Teamer-Wertung ist also toter Code. **Funktional in Ordnung**, siehe Befund E.

**8. `mandatory_event_count`** — Soll: besuchte Pflicht-Events. Wertung
badges.js:291-301 zählt `attendance_status='present' AND e.mandatory=true`,
Fortschritt konfiBadgeProgress.js:78-81 byte-identisch (Konsistenz-Vertrag
eingehalten). Kein Teamer-Zweig — im Formular für Teamer ausgeblendet
(Modal:113), also konsistent. **In Ordnung**, aber in Produktion praktisch
unerreichbar konfiguriert, siehe Befund B.

**9. `unique_activities`** — Konfi: `SELECT DISTINCT activity_id` und dann
`.length` (badges.js:172, 185); Fortschritt `COUNT(DISTINCT activity_id)`
(konfiBadgeProgress.js:86). Gleiche Semantik. Teamer badges.js:381, 545 mit
`target_role='teamer'`-Filter, Fortschritt teamer.js:302-307 identisch.
**In Ordnung.**

### Aktivitäts-Typen (Namensbindung)

**10. `specific_activity`** — Soll: bestimmte Aktivität X-mal. Wertung
Konfi badges.js:220-229, Teamer badges.js:502-517: Join über `a.name = $2`.
Beide haben eine Abkürzung für `criteria_value <= 1`: dann reicht
Vorhandensein in der Namensliste, sonst zählende Query. Beide Wege liefern
dasselbe Ergebnis, die Abkürzung ist nur eine Ersparnis. Fortschritt Konfi
konfiBadgeProgress.js:236, Teamer teamer.js:450-455 zählen nach Namen.
**Logik in Ordnung, aber Namensbindung — Befund A.** Zusätzlich: der
Konfi-Zweig filtert NICHT auf `a.target_role` (badges.js:223), der
Teamer-Zweig schon (badges.js:509). In Produktion gibt es aktuell keine
Aktivität, die denselben Namen in beiden Rollen trägt (Query gegen Org 1:
0 Treffer) — der Fehler ist also latent, nicht wirksam.

**11. `activity_combination`** — Soll: mindestens `criteria_value` Aktivitäten
aus der Liste. Konfi badges.js:231-236: `matchCount >= criteria_value`.
Teamer badges.js:408-436 seit `7f70cd7b` gleiche Regel, zusätzlich zählen
`required_events` mit, wenn hinterlegt. Fallback bei Wert 0: `noetig =
gefordert` (badges.js:433) — greift durch die neue Mindestwert-1-Validierung
nur noch für Altbestand. Fortschritt Konfi konfiBadgeProgress.js:257-267,
Teamer teamer.js:461-472 (dort inkl. Events). **In Ordnung.**
Anmerkung: `required_events` kann das Formular weiterhin nicht erzeugen
(Modal:302-311 speichert nur `required_activities`) — nur per API befüllbar.

**12. `category_activities`** — Soll: Aktivitäten + Events aus einer Kategorie.
Konfi badges.js:238-260 (UNION ALL über `activity_categories` und
`event_categories`, Kategorie über `c.name`), Fortschritt
konfiBadgeProgress.js:95-108 gleiche UNION. Teamer badges.js:519-540,
Fortschritt teamer.js:326-341. **Logik in Ordnung, Namensbindung — Befund A.**

### Zeit-Typen

**13. `time_based`** — Soll: X Aktivitäten/Events in Y Wochen. Wertung
badges.js:262-281: `days = criteria.days || criteria.weeks * 7`, Cutoff über
Millisekunden, zählt Datensätze ab Cutoff. Fortschritt
konfiBadgeProgress.js:279-291 identisch gerechnet. Das Formular speichert
`days = weeks * 7` (Modal:305-307) und rechnet beim Bearbeiten zurück
(Modal:213-215). Teamer-Wertung badges.js:547-568 existiert, ist aber toter
Code (im Formular ausgeblendet, Modal:113). **In Ordnung**, siehe Befund E.

**14. `streak`** — Soll: X ISO-Wochen in Folge aktiv. Wertung badges.js:315
über `checkStreakCriteria` (badges.js:574-596) und die gemeinsame Util
`computeCurrentStreak`. Fortschritt Konfi konfiBadgeProgress.js:275, Teamer
teamer.js:474-476 — dieselbe Util. Einzige Quelle, kein Drift möglich.
**In Ordnung**, Anzeigeschwäche siehe Befund G.

### Teamer-Typ

**15. `teamer_year`** — Soll: Anzahl Jahre mit mindestens einer
Teamer-Aktivität/einem Event ab `users.teamer_since`, Lücken erlaubt. Wertung
badges.js:438-495: Startjahr aus `teamer_since`, Fallback älteste
Teamer-Aktivität, dann `Set` der Jahre, gefiltert auf `>= startYear`.
Fortschritt teamer.js:396-437 identisch (gleiche Fallback-Kette). **In
Ordnung.** Anmerkung: die beiden Wertungs-Queries (badges.js:455-461,
474-484) filtern nicht auf `organization_id`, die Fortschritts-Query schon —
praktisch folgenlos, da ein Konto genau einer Organisation angehört.

### Legacy

`collection` und `yearly` haben keine Wertung. Sie stehen nicht in
`CRITERIA_TYPES`, sind also nicht anlegbar; im Backend nur als
Fortschritts-Fall `0` (teamer.js:486-489), im Frontend als leere Kategorien
(konfi/views/BadgesView.tsx:286-287). In Produktion existiert kein einziges
Abzeichen dieser Typen (Query über alle unbekannten `criteria_type`: 0 Zeilen).
Reine Karteileichen im Code.

**Fazit Teil 1: Alle 15 Typen werten das, was ihr Hilfetext verspricht. Die
Konsistenz zwischen Wertung und Fortschritt hält in beiden Rollen. Der letzte
echte Semantikbruch (`activity_combination` Teamer) ist mit `7f70cd7b` zu.**

---

## Befunde, nach Schwere

### A. HOCH: Namensbindung — vier Abzeichen sind in Produktion tot

**Im Code bestätigt.** `specific_activity`, `activity_combination` und
`category_activities` speichern NAMEN, und die Wertung joint über den Namen:

- badges.js:223 `WHERE ... a.name = $2` (specific_activity, Konfi)
- badges.js:509 dasselbe für Teamer
- badges.js:246, 254 `WHERE ... c.name = $2` (category_activities)
- badges.js:233 Vergleich der Namensliste gegen `completedActivityNames`

Ein Umbenennen der Aktivität oder Kategorie trennt die Verbindung, ohne dass
irgendwo eine Warnung erscheint. Es gibt keinen Hinweis im Kategorien- oder
Aktivitäten-Editor und keinen Nachzieh-Mechanismus.

**In Produktion nachgemessen.** Abgleich aller gespeicherten Namen gegen
`activities` bzw. `categories` derselben Organisation:

| Abzeichen | Org | Typ | Gesuchter Name | Existiert? |
|---|---|---|---|---|
| 35 „Zukunftsteamer:in" | 1 | category_activities | `Jugend` | **nein** |
| 36 „Senioren-Supporter:in" | 1 | category_activities | `Senior:innen` | **nein** — die Kategorie heißt heute `Seniorinnen` (categories.id=4) |
| 197 „Treuer Gottesdienstbesucher" | 5 | specific_activity | — speichert noch `{"activity_id":58}` | Altformat, wird von der Wertung nie gelesen |
| 50 „Undercover-Konfi" | 1 | specific_activity | `criteria_extra = {}` | keine Bedingung hinterlegt |

Alle vier: `is_active = true`, `vergaben = 0`. Bei 35 und 36 ist der
Umbenennungs-Fall belegbar: „Senior:innen" -> „Seniorinnen" ist genau der
beschriebene stille Bruch, das Abzeichen zeigt seither dauerhaft 0 Fortschritt.

Die restlichen namensgebundenen Abzeichen sind sauber verknüpft: 39
(Adventsgottesdienst), 42 (Jahreswechsel-Gottesdienst), 56 (Taufe), 87
(Konfi-Freizeit begleitet), 53 (Taufe/Hochzeit/Beerdigung — alle drei
vorhanden), 7, 34, 37, 38, 54, 88, 194, 195, 196 (Kategorien vorhanden).

**Wirkung heute:** Abzeichen 35 und 36 sind für Konfis der Org 1 unerreichbar.
Sie werden auch nicht ausgeblendet: `isUnreachable` in
konfiBadgeProgress.js:176-184 prüft nur die deaktivierten Punktarten und die
fehlende Bedingung — nicht, ob der hinterlegte Name noch existiert. Beide sind
`is_hidden = true`, tauchen also nicht in „erreichbar" auf, zählen aber in
`totalSecret` mit und verwässern die Prozent-Kachel.

**Fix:** kurzfristig die zwei Namen in `criteria_extra` korrigieren (Datenpflege,
nicht Code). Mittelfristig: entweder beim Umbenennen einer Kategorie/Aktivität
die `criteria_extra` betroffener Abzeichen mitziehen, oder in `isUnreachable`
zusätzlich prüfen, ob der Name noch auflösbar ist — dann fällt so ein Fall
wenigstens auf, statt still zu bleiben.

### B. MITTEL: Drei `mandatory_event_count`-Abzeichen sind praktisch unerreichbar

Die Wertung stimmt (siehe Typ 8), aber die Schwellen passen nicht zu den Daten:

| Abzeichen | Org | Wert | Pflichttermine in der Org | höchster Ist-Stand eines Kontos | vergeben |
|---|---|---|---|---|---|
| 89 „Pflichtbewusst" | 1 | 10 | 11 | **2** | 0 |
| 135 „Zuverlässig" | 4 | 5 | 3 | — (keine Anwesenheit erfasst) | 0 |
| 189 „Zuverlässig" | 5 | 5 | 13 | **1** | 0 |

Bei Org 4 ist die Schwelle 5 höher als die Zahl der überhaupt existierenden
Pflichttermine (3) — das Abzeichen kann dort selbst bei perfekter Anwesenheit
nie kommen. Bei 89 und 189 ist es rechnerisch möglich, aber der reale Abstand
ist groß (2 von 10, 1 von 5).

Das ist keine Fehlfunktion, sondern eine Konfigurationsfrage — sie fällt nur
niemandem auf, weil nichts warnt. Kein Codefix nötig; erwähnenswert wäre ein
Hinweis im Formular, wenn der Wert die Zahl vorhandener Pflichttermine
übersteigt.

### C. MITTEL: Wert über 20 wird beim Bearbeiten still auf 20 gestutzt

Der Wert-Regler im Formular ist auf `min={1} max={20}` begrenzt
(BadgeManagementModal.tsx:990). Angelegt wurden viele Abzeichen aber per
Seed/Migration mit höheren Werten. In Produktion betroffen: **8 Abzeichen**

| ID | Org | Name | Typ | Wert |
|---|---|---|---|---|
| 15 | 1 | Punkte-Profi | total_points | 30 |
| 51 | 1 | Jahres-Held | streak | 26 |
| 63 | 2 | Punktemeister | total_points | 25 |
| 157 | 2 | Punkte-Profi | total_points | 30 |
| 98 | 3 | Punktemeister | total_points | 25 |
| 160 | 3 | Punkte-Profi | total_points | 30 |
| 118 | 4 | Punktemeister | total_points | 25 |
| 172 | 5 | Punktemeister | total_points | 25 |

Öffnet die Leitung eines dieser Abzeichen und speichert — auch ohne den Regler
anzufassen, etwa nur um die Beschreibung zu ändern —, sendet das Formular den
geladenen Wert. Ob `IonRange` bei einem Wert über `max` von sich aus auf 20
zurücksetzt, hängt vom Komponentenverhalten ab; sichtbar ist er auf dem Regler
jedenfalls nicht korrekt darstellbar. Aus „30 Punkte" würde unbemerkt „20
Punkte", und weil die Wertung dann für viele sofort erfüllt ist, ginge das
Abzeichen schlagartig an alle, die 20 Punkte haben.

Das ist **nicht durch Messung, sondern durch Lesen des Codes belegt** — ich habe
es nicht in der laufenden App durchgespielt. Der Zusammenhang „gespeicherter
Wert liegt außerhalb des Reglerbereichs" ist aber eindeutig, und die
Auswirkung wäre nicht rückholbar (einmal vergebene Abzeichen bleiben, badges.js
kennt keinen Entzug). Vor dem Release nachstellen und dann entweder `max`
erhöhen oder den Regler durch ein Zahlenfeld ersetzen.

### D. MITTEL: Vier aktive Abzeichen ohne jede Bedingung

`is_active = true`, aber `criteria_extra` leer — die Wertung prüft
`if (criteria.required_activities)` (badges.js:232) bzw.
`if (criteria.required_activity_name)` (badges.js:221) und bleibt still `false`:

| ID | Org | Name | Typ | Wert | vergeben |
|---|---|---|---|---|---|
| 40 | 1 | Osterlachen | activity_combination | 3 | 0 |
| 41 | 1 | Weihnachts-Insider | activity_combination | 3 | 0 |
| 43 | 1 | Kirchenjahr-Experte | activity_combination | 4 | 0 |
| 50 | 1 | Undercover-Konfi | specific_activity | 8 | 0 |

Neu anlegbar sind solche Abzeichen seit `9d3eeeb3` nicht mehr
(`validateCriteriaExtra`, badges.js:667-693). Der Altbestand blieb liegen. 40,
41 und 43 sind `is_hidden = true`, 50 ebenfalls — sie erscheinen den Konfis
also nicht unter „erreichbar" (konfiBadgeProgress.js:298 filtert
`unreachable`, und `bedingungFehlt` erkennt genau diesen Fall,
konfiBadgeProgress.js:151-172). Sie zählen aber in `totalSecret` mit und
drücken damit die Prozent-Anzeige.

**Fix:** die vier entweder befüllen oder deaktivieren. Reine Datenpflege.

Zusätzlich Abzeichen 197 (Org 5) mit dem Altformat `{"activity_id":58}` — die
Aktivität 58 „Gottesdienstbesuch" existiert, aber die Wertung liest den
Schlüssel `activity_id` nicht mehr. Beim Bearbeiten im Formular würde es
allerdings korrekt zurückübersetzt (Modal:220-224) und beim Speichern als Name
abgelegt — also durch einmaliges Öffnen und Speichern heilbar.

### E. NIEDRIG: Toter Code in beide Richtungen bei den Teamer-Typen

Die Wertung im Teamer-Zweig behandelt `event_count` (badges.js:400-403),
`streak` (badges.js:405-407) und `time_based` (badges.js:547-568). Das Formular
blendet genau diese drei plus `mandatory_event_count` für Teamer aus
(BadgeManagementModal.tsx:113 `TEAMER_HIDDEN_TYPES`). Über die App entsteht
also nie ein solches Abzeichen; per API schon (das Backend validiert die
Kombination `target_role` x `criteria_type` nicht).

Umgekehrt: `bonus_points` und die vier Punkte-Typen werden im Teamer-Zweig
aktiv übersprungen (badges.js:356, 388) — auch das ein Fall, der über die App
nicht entstehen kann.

In Produktion gibt es kein Teamer-Abzeichen dieser Typen (alle 13 Teamer-
Abzeichen sind `teamer_year`, `specific_activity` oder `category_activities`).
Kein akuter Schaden; entweder die Typen im Formular freigeben oder die Wertung
entfernen — Hauptsache, beide Seiten sagen dasselbe.

### F. NIEDRIG: Teamer-Zweig hat keine Absicherung gegen doppelt kodiertes JSON

Konfi-Zweig (badges.js:192-194) und Fortschritts-Berechnungen prüfen vor dem
Parsen, ob bereits ein Objekt vorliegt. Der Teamer-Zweig nicht:

    const criteria = JSON.parse(badge.criteria_extra || '{}');   // badges.js:391

Heute harmlos: die Spalte ist `text` (nachgesehen in
`information_schema.columns`), und in Produktion ist kein einziger Wert doppelt
kodiert (alle 66 nicht-leeren Werte beginnen mit `{`). Würde die Spalte je auf
`jsonb` umgestellt — was für Befund A der naheliegende Weg wäre —, wirft diese
Zeile bei jedem Teamer-Abzeichen und die gesamte Teamer-Wertung bricht ab.
Das Frontend hat die doppelte Entschachtelung übrigens bereits eingebaut
(Modal:195-204, admin/BadgesView.tsx:167-168) — jemand ist dem Fall dort schon
begegnet.

Zwei Zeilen, die den Konfi-Zweig kopieren, schließen das vorbeugend.

### G. NIEDRIG: `computeCurrentStreak` misst nicht bis heute

`computeCurrentStreak` (streakCalculation.js:52-79) beginnt bei der NEUESTEN
aktiven Woche, nicht bei der laufenden. Eine vor Monaten gerissene Serie steht
im Fortschritt weiter als aktueller Streak. Für die Vergabe belanglos (der
Stunden-Takt hätte damals vergeben), für die Anzeige irreführend — ein Konfi
sieht „6 Wochen Serie", obwohl er seit acht Wochen nichts gemacht hat.
Unverändert gegenüber der Doku.

### H. NIEDRIG: Kein Unerreichbar-Filter im Teamer-Pfad

`konfiBadgeProgress.js:176-186` markiert unerreichbare Abzeichen und blendet
sie aus. `GET /teamer/badges` (teamer.js:265-506) kennt weder `unreachable`
noch `bedingungFehlt` — ein Teamer-Abzeichen ohne hinterlegte Bedingung oder
mit totem Namen stünde dort mit 0 Prozent in der Liste. In Produktion aktuell
kein Fall (alle 13 Teamer-Abzeichen sind sauber verknüpft), aber die
Asymmetrie zum Konfi-Pfad bleibt.

### I. NIEDRIG: Teamer-„gesehen" weiterhin tot (alter Befund 10, unverändert)

`GET /teamer/badges/unseen` (teamer.js:524) und `PUT /teamer/badges/mark-seen`
(teamer.js:542) werden im Frontend nirgends aufgerufen — der einzige
Frontend-Treffer für `mark-seen` ist der Konfi-Pfad
(KonfiBadgesPage.tsx:99, 105, dort als POST). `seen` bleibt für Teamer dauerhaft
false. Zusätzlich Methoden-Inkonsistenz (POST beim Konfi, PUT beim Teamer).

---

## Teil 2: Was liegt überflüssig in der Datenbank?

**Verwaiste Zeilen: keine.** Drei Gegenproben, alle 0:

- `user_badges` ohne zugehöriges `custom_badges`: 0
- `user_badges`, deren `organization_id` von der des Abzeichens abweicht: 0
- `user_badges` zu gelöschten oder nicht existierenden Konten: 0

Der UNIQUE-Index und die transaktionale Aufräumung beim Löschen
(badges.js:844-860) halten die Tabelle sauber.

**Nie vergebbare oder nie vergebene Abzeichen.** 174 Abzeichen in 5
Organisationen. Klar tot bzw. praktisch tot:

- 4 ohne Bedingung (Befund D): 40, 41, 43, 50
- 2 mit totem Namen (Befund A): 35, 36
- 1 im Altformat (Befund A): 197
- 3 mit unrealistischer Pflichttermin-Schwelle (Befund B): 89, 135, 189

Darüber hinaus sind ganze Typgruppen in den kleineren Organisationen noch nie
vergeben worden, was aber schlicht daran liegt, dass dort kaum Daten liegen
(Org 3 und 5 haben nahezu keine Vergaben über alle Typen). Das ist kein
Befund, sondern Nutzungsstand.

**Auffällig, aber in Ordnung:** 108 Abzeichen haben `criteria_extra = NULL`,
47 haben `'{}'` — beides derselbe Sachverhalt, unterschiedlich geschrieben
(`POST` schreibt `null`, wenn kein `criteria_extra` mitkommt, badges.js:800).
Für alle Typen ohne Zusatzbedingung ist das folgenlos, die Wertung fällt in
beiden Fällen auf `{}` zurück. Nur inkonsistent.

**`sort_order`** existiert in der Tabelle, wird vom Formular nie gesetzt und
von keiner Sortierung gelesen (Listen sortieren nach `created_at` bzw.
`criteria_type`/`name`). Eine ungenutzte Spalte.

---

## Teil 3: Weitere Null-Fallen und Typverwechslungen

Gezielt gesucht nach der Fehlerklasse des schon gefundenen Falls
(`x >= null` ist in JS wahr).

**Geschlossen:** Der Ursprungsfall ist zu. `criteria_value` wird in beiden
Wertungs-Queries als `criteria_value::int` gelesen (badges.js:145, 346), Create
und Update verlangen `isInt({min:1})` (badges.js:702, 711), und ein Test deckt
beide Richtungen ab (badges.test.js:183, 332, 353).

**Verbleibende Auffälligkeiten, alle ohne akute Wirkung:**

1. **Division durch den Zielwert.** `progress.percentage = (current / target) *
   100` (konfiBadgeProgress.js:294) — `target` ist `badge.criteria_value || 1`
   (Zeile 194), fängt 0 und NULL also ab. Der Teamer-Pfad macht es genauso
   (teamer.js:414 `criteria_value || 1`). Sauber.

2. **`parseInt` ohne Radix an mehreren Stellen** (badges.js:184-186,
   konfiBadgeProgress.js:83-88). Bei rein numerischen Strings aus pg folgenlos,
   aber uneinheitlich — an anderen Stellen steht `parseInt(x, 10)`.

3. **`badge.criteria_value` in der Fortschritts-Anzeige ist ein String.**
   `konfiBadgeProgress.js` liest `cb.*` (Zeile 24), also `criteria_value` als
   Text aus dem `bigint`. Bei `progress.target = badge.criteria_value || 1`
   (Zeile 194) und der anschließenden Division rettet JavaScript das durch
   implizite Umwandlung, und bei verdienten Abzeichen wird
   `current: badge.criteria_value` (Zeile 189) als String weitergereicht.
   Das Frontend sortiert damit: `.sort((a,b) => a.criteria_value -
   b.criteria_value)` (konfi/views/BadgesView.tsx:267 ff.) — Subtraktion
   erzwingt Zahlen, funktioniert also. Ein `a.criteria_value <
   b.criteria_value` an gleicher Stelle würde dagegen lexikografisch
   sortieren („30" vor „5"). Latente Falle derselben Klasse wie der bereits
   behobene String-Konkatenationsfehler. Die Wertung selbst ist mit
   `criteria_value::int` sauber.

4. **`criteria.days || (criteria.weeks ? criteria.weeks * 7 : null)`**
   (badges.js:264, 550, konfiBadgeProgress.js:283): `days = 0` fiele auf den
   `weeks`-Zweig, ohne `weeks` auf `null`, und dann wird der ganze Fall
   übersprungen — `earned` bleibt `false`. Sicheres Verhalten. Seit
   `9d3eeeb3` verlangt die Validierung ohnehin `days >= 1` oder `weeks >= 1`
   (badges.js:686-689).

5. **`badgeEarned = allMet && (...)` gibt kein Boolean mehr zurück** — der in
   der Doku als Nebenbefund 7 genannte Fall ist mit `7f70cd7b` verschwunden;
   badges.js:434 setzt jetzt `gefordert > 0 && treffer >= noetig`, sauber
   boolesch.

6. **`if (!jahrgangConfig)`** (badges.js:198): Konfis ohne Jahrgang bekommen
   `total_points` nie, und `gottesdienst_points`/`gemeinde_points` greifen über
   den Optional-Chain `jahrgangConfig?.` (Zeile 206, 210) ebenfalls nicht.
   Konsistent, kein Loch.

Kein weiterer Fall der Klasse „Vergleich gegen null/undefined liefert
versehentlich wahr" gefunden.

---

## Priorisierung

### Vor Release 2.0.0

1. **Befund C — Reglergrenze 20 gegen 8 Abzeichen mit höherem Wert.**
   Nachstellen (ein Abzeichen mit Wert 30 öffnen und speichern), und wenn sich
   der Wert stutzt, `max` anheben oder den Regler ersetzen. Das ist der einzige
   Befund, der aus einer harmlosen Handlung eine nicht rückholbare
   Fehlvergabe machen kann.
2. **Befund A — Datenpflege.** Die zwei Kategorienamen in Abzeichen 35 und 36
   (Org 1) richtigstellen, Abzeichen 197 (Org 5) einmal öffnen und speichern.
   Reines SELECT-Wissen, der Eingriff selbst gehört in einen eigenen Schritt.
3. **Befund D — vier bedingungslose Abzeichen** (40, 41, 43, 50) befüllen oder
   deaktivieren.

### Kann warten

4. **Befund A, Codeseite** — Umbenennen soll die `criteria_extra` mitziehen
   oder wenigstens als unerreichbar erkennbar machen. Der saubere Weg (IDs
   statt Namen) ist ein eigener Umbau und braucht eine Migration für den
   Altbestand.
5. **Befund F** — zwei Zeilen im Teamer-Zweig, vorbeugend, kostet nichts.
6. **Befund B** — Warnung im Formular, wenn die Pflichttermin-Schwelle über der
   Zahl vorhandener Pflichttermine liegt.
7. **Befund H** — Unerreichbar-Filter auch im Teamer-Pfad.
8. **Befund I** — Teamer-„gesehen" anbinden oder die beiden Endpunkte entfernen.

### Kosmetik

9. **Befund E** — toter Code in beide Richtungen bei den Teamer-Typen
   auflösen.
10. **Befund G** — Streak-Anzeige auf „bis heute" umstellen.
11. `parseInt`-Radix vereinheitlichen; `criteria_value` im Fortschritt als Zahl
    liefern (Punkt 3 oben); `criteria_extra` NULL gegen `'{}'` vereinheitlichen;
    `sort_order` nutzen oder entfernen; `collection`/`yearly` aus den
    Anzeige-Resten streichen.
