# Skizze: Challenges mit einmaligen Unikat-Badges

Stand 30.07.2026 — Konzept-Skizze vor Milestone-Planung. KEIN Duell-/
Wettbewerbs-Modus (Konfi gegen Konfi) — bewusst ausgeschlossen.

## Idee in einem Satz

Admins rufen zeitlich begrenzte Challenges aus ("3 Gottesdienste an 3 Sonntagen
in Folge", "4 Veranstaltungen in 4 Wochen") — wer sie schafft, bekommt ein
**einmaliges Unikat-Badge**, das nur über diese Challenge erringbar ist und
nach Ablauf nie wieder (Sammelcharakter, wie Apple-Watch-Monats-Challenges).

## Abgrenzung zum Badge-System

| | Badges (heute) | Challenges (neu) |
|---|---|---|
| Verfügbarkeit | dauerhaft erreichbar | nur im Challenge-Zeitraum |
| Wertungsfenster | gesamte Konfi-Zeit bzw. rollierend | fester Zeitraum (von–bis) |
| Badge | beliebig oft "nachholbar" | Unikat, danach nie wieder |
| Anlage | statischer Katalog | wird ausgerufen, hat Anfang und Ende |

## Der zentrale Design-Hebel: bestehende Kriterien wiederverwenden

Das Badge-System (badges.js `CRITERIA_TYPES` + utils/konfiBadgeProgress.js +
utils/streakCalculation.js) kann fast alles schon. Challenges = bestehende
Kriterien plus zwei Erweiterungen:

1. **Festes Zeitfenster** statt "gesamte Konfi-Zeit" / rollierendem Fenster:
   gewertet wird nur, was zwischen `starts_at` und `ends_at` passiert
   (completed_date der Aktivität bzw. Event-Datum mit bestätigter Anwesenheit).
2. **Optionaler Filter** auf Kategorie ODER spezifische Aktivität ODER
   Event-Typ — damit "3 Gottesdienste" nicht jede Gemeinde-Aktivität mitzählt.

### Wunsch-Beispiele des Users → Abbildung

| Challenge | Kriterium | Umsetzung |
|---|---|---|
| 3 Gottesdienste an 3 Sonntagen in Folge | `streak` + Kategorie-Filter | streakCalculation auf gefilterte Datumsliste (ISO-Wochen-Logik existiert; zählt Wochen, nicht Sonntage — für Konfis identisch genug) |
| 3 Gottesdienste in 6 Wochen | `category_activities` + Zeitfenster | Count im Fenster, Kategorie "Gottesdienst" |
| 4 Veranstaltungen in 4 Wochen | `event_count` + Zeitfenster | bestätigte Anwesenheit im Fenster |
| 2 Taufen in einem Monat | `specific_activity` oder Kategorie "Kasualien" + Zeitfenster | Count im Fenster |

**Sinnvolle Kriterien-Teilmenge für v1** (nicht alle CRITERIA_TYPES freigeben):
- `category_activities` im Zeitfenster (deckt Gottesdienste, Kasualien, ...)
- `specific_activity` im Zeitfenster
- `event_count` im Zeitfenster (ggf. mit Event-Kategorie-Filter)
- `streak` mit Kategorie-Filter (Start des Streaks muss im Fenster liegen)
- `activity_count` im Zeitfenster (alles zählt)

NICHT sinnvoll für Challenges: Punkte-Kriterien (total/gottesdienst/gemeinde_points
sind Lebenszeit-Summen — im Zeitfenster wären das verkappte Counts),
`teamer_year`, `activity_combination` (v2, z.B. Adventskalender-Challenge).

## Datenmodell (Vorschlag)

```sql
challenges: id, organization_id, title, description,
            starts_at, ends_at,                  -- Wertungsfenster
            criteria_type, criteria_value, criteria_extra (JSONB: Kategorie-/
            Aktivitäts-Filter, wie bei custom_badges),
            badge_id -> custom_badges,           -- das Unikat-Badge
            target_role ('konfi' | 'teamer'),    -- v1: nur konfi
            is_active, created_by, created_at

challenge_jahrgang_assignments: challenge_id, jahrgang_id
  -- analog event_jahrgang_assignments; keine Zuordnung = alle Jahrgänge der Org

-- Vergabe: bestehende user_badges (konfi_badges) reicht — Badge trägt die
-- Auszeichnung. Optional challenge_completions (user_id, challenge_id,
-- completed_at) für "wer hat wann geschafft" + Wrapped-Statistik.
```

Unikat-Badge = `custom_badges` mit Flag `challenge_only` (Migration):
- taucht NICHT in der normalen "erreichbare Badges"-Liste auf,
- zählt aber in der Sammlung/Anzeige (auch Admin-/Teamer-Detailansicht),
- wird von checkAndAwardBadges NICHT regulär gewertet (nur via Challenge).

## Wertung

- **Trigger wie heute:** nach Punkte-/Aktivitäts-/Anwesenheits-Buchung läuft
  neben checkAndAwardBadges ein checkChallenges(userId) über die aktiven
  Challenges der Org/des Jahrgangs. Gleiche Konsistenz-Regel wie beim
  Badge-Refactor: **Wertung und Fortschritts-Anzeige aus EINER Quelle**
  (utils/challengeProgress.js o.ä., nutzt streakCalculation/konfiBadgeProgress).
- **Rückwirkend nachgetragene** Aktivitäten mit completed_date im Fenster
  zählen (Wertung rechnet immer über die Daten, nicht über Ereignisse) — auch
  nach Challenge-Ende: wer's im Zeitraum getan hat, kriegt das Badge, auch wenn
  der Admin es erst später einträgt. Kein Abschluss-Cron nötig, wenn die
  Wertung bei jeder Buchung UND beim Lesen des Challenge-Status läuft.
- Punkte-Kategorien-Guard beachten (checkPointTypeEnabled): deaktivierte
  Punkt-Typen dürfen keine Challenge-Kriterien anbieten.

## UI

**Konfi:**
- Dashboard-Karte "Laufende Challenge" mit Fortschritt (z.B. 2/3, Restzeit)
  — Design analog Activity-Ringe/Countdown, Referenz EventsView.
- Bereich bei den Badges: "Challenges"-Sektion (laufend + errungene
  Unikat-Badges), abgelaufene nicht geschaffte verschwinden.
- Push: Challenge gestartet (an Ziel-Jahrgänge), Challenge geschafft,
  optional "noch 1 Woche"-Erinnerung (v2).

**Admin (org_admin UND admin — Jahrgangs-Admins können für ihre Jahrgänge
ausrufen; final zu entscheiden):**
- Challenge-CRUD unter Verwaltung (Pattern: Admin-Unterseiten wie Badges).
- Anlage-Flow: Titel/Beschreibung → Zeitraum → Kriterium (Teilmenge, mit
  denselben Hilfetexten wie Badge-Anlage) → Jahrgänge → Badge gestalten
  (Icon/Farbe wie custom_badges; eigenes Artwork-Upload = v2).
- Laufende Challenge: Teilnehmer-Fortschritt einsehen ("5 von 21 geschafft").
- Bearbeiten nach Start nur eingeschränkt (Zeitraum verlängern ja,
  Kriterium ändern nein — sonst Wertungs-Chaos).

**Teamer:** v1 read-only (sehen Challenge-Fortschritt ihrer Jahrgänge nicht
nötig — offen). Teamer-Challenges = v2.

## Ideenkatalog: Welche Challenges könnte es geben?

Gesammelt 30.07. — sortiert nach Machbarkeit mit dem heutigen Datenmodell.
Namen sind Arbeitstitel; Orgs definieren ihre Challenges selbst, aber
Vorlagen (s.u.) senken die Einstiegshürde.

### Rhythmus & Dranbleiben (v1, streak/time_based + Filter)

- **Sonntags-Serie:** 3 Gottesdienste an 3 Sonntagen in Folge (das Ur-Beispiel).
- **Perfekter Monat:** in jeder der 4 Wochen eines Monats mindestens 1
  Aktivität/Event (= streak 4 im Fenster).
- **Ferien-Treue:** Streak über die Sommer-/Weihnachtsferien halten — gerade
  dann aktiv bleiben, wenn alle wegfahren (kleines Ziel, z.B. 2 in 6 Wochen).
- **Starter-Sprint:** in den ersten 4 Wochen nach Jahrgangs-Start 3
  Aktivitäten — holt neue Konfis früh in den Rhythmus (an invite/Anlage-Datum
  koppeln oder einfach als Zeitraum-Challenge im September ausrufen).

### Zeitfenster-Counts (v1, category/specific/event_count + Fenster)

- **Gottesdienst-Sechser:** 3 Gottesdienste in 6 Wochen.
- **Event-Marathon:** 4 Veranstaltungen in 4 Wochen.
- **Kasualien-Monat:** 2 Taufen (oder Kasualien) in einem Monat.
- **Gemeinde-Sommer:** 3 Gemeinde-Aktivitäten in den Sommerferien.
- **Doppelgänger:** je 1 Gottesdienst- UND 1 Gemeinde-Aktivität in 2 Wochen
  (= both_categories-Idee als Fenster-Variante; braucht Zwei-Filter-Wertung,
  eher v1.5).

### Kirchenjahr & Saison (v1, meist specific_activity/category + Fenster)

Das ist die inhaltlich stärkste Gruppe — Challenges entlang des Kirchenjahres
geben dem Feature einen kirchlichen Charakter statt reiner Gamification:

- **Advents-Challenge:** 3 der 4 Adventssonntage besucht.
- **Fasten-Begleiter:** in den 7 Wochen der Passionszeit 4x dabei.
- **Osternacht/Christmette:** 1x bei einem besonderen Gottesdienst
  (specific_activity, Wert 1) — niedrigschwellig, besonderes Badge.
- **Erntedank-Helfer:** 1 Gemeinde-Aktivität rund um Erntedank.
- **Kirchenjahr-Entdecker** (v2, activity_combination): je 1x Christmette,
  Osternacht, Konfi-Gottesdienst, Erntedank innerhalb des Konfi-Jahres.

### Kooperativ statt kompetitiv (v2 — der Ersatz für den gestrichenen Duell-Modus)

- **Jahrgangs-Ziel:** der GANZE Jahrgang sammelt gemeinsam, z.B. "100
  Gottesdienst-Besuche im Advent — schafft ihr es zusammen, bekommen ALLE das
  Badge". Kein Gegeneinander, Gruppendruck wirkt positiv ("komm mit, uns
  fehlen noch 8"). Fortschrittsbalken für den Jahrgang im Dashboard.
- **Staffel:** in N aufeinanderfolgenden Wochen war IMMER mindestens ein Konfi
  des Jahrgangs aktiv (Jahrgangs-Streak).

### Entdecken & Vielfalt (v2, braucht History-Vergleich)

- **Neuland:** 3 Aktivitäten, die du noch NIE gemacht hast (unique_activities
  im Fenster relativ zur eigenen Vorgeschichte).
- **Allrounder:** in einem Monat Aktivitäten aus 3 verschiedenen Kategorien.

### Teamer-Challenges (v2, target_role='teamer')

- **Begleiter:** 4 Events in 4 Wochen begleitet.
- **Saison-Support:** in der Konfi-Anmeldephase 3x geholfen.

### Vorlagen-Idee (v1.5)

Mitgelieferte Challenge-Vorlagen (Advent, Passionszeit, Sommerferien,
Perfekter Monat) mit vorgeschlagenem Kriterium + Badge-Design, die org_admins
per Klick ausrufen und anpassen — analog Default-Badges bei Org-Anlage
(organizations.js). Später denkbar: automatische Monats-Challenge pro Org
(Apple-Watch-Modell), aber erst wenn manuelle Challenges sich bewährt haben.

## Offene Entscheidungen (vor Planung klären)

1. Dürfen Jahrgangs-Admins Challenges anlegen oder nur org_admin?
2. `challenge_completions`-Tabelle ja/nein (für Wrapped: "Du hast 3 Challenges
   geschafft")?
3. Streak-Semantik: ISO-Wochen (vorhandene Logik) ok, oder echte
   "Sonntage in Folge"? (ISO-Wochen empfohlen — Logik existiert, verhält sich
   für Wochenend-Gottesdienste identisch.)
4. Sichtbarkeit verpasster Challenges: ganz weg oder ausgegraut ("verpasst")
   als Ansporn? (Apple zeigt verpasste nicht — empfohlen: weg.)
5. Max. parallel laufende Challenges pro Jahrgang begrenzen (UI-Übersicht)?

## Nebenbei mitnehmen

Kleine Dependency-Updates (Ionic 8.8.16, Capacitor 8.4.2 etc., npm outdated
30.07., keine Majors).
