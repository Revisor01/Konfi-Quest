# Audit Badge-System (Phase 116)

**Datum:** 2026-05-31
**Art:** Read-only Befund. Keine Code-Aenderungen.
**Ziel:** Bestandsaufnahme fuer zwei geplante Badge-Typen (Pflicht-Anwesenheits-Anzahl, Teamer-Jahre) + Analyse des prozentualen Fortschritts-Bugs.

---

## 1. Badge-Schema

Die Badge-Definitionen liegen in der Tabelle **`custom_badges`** (NICHT `badges`). Die Zuordnung User<->Badge liegt in **`user_badges`** (frueher `konfi_badges`, umbenannt in Migration 076).

Schema (aus `backend/tests/globalSetup.js:186-214`, identisch zur Prod-Struktur):

```sql
custom_badges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(100),
  description TEXT,
  criteria_type VARCHAR(50) NOT NULL,   -- Kriterium-Typ (Steuerung der Wertung)
  criteria_value INTEGER,               -- Schwellwert (z.B. 12)
  criteria_extra JSONB,                 -- Zusatzparameter (z.B. required_category, days, weeks)
  is_hidden BOOLEAN DEFAULT false,
  color VARCHAR(7) DEFAULT '#667eea',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  target_role VARCHAR(10) DEFAULT 'konfi',  -- 'konfi' | 'teamer' (Rollen-Zuordnung)
  created_by INTEGER REFERENCES users(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES custom_badges(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  awarded_date DATE DEFAULT CURRENT_DATE,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  seen BOOLEAN DEFAULT false,
  UNIQUE(user_id, badge_id)
)
```

Die das Kriterium definierenden Spalten: **`criteria_type`** (Typ-Logik), **`criteria_value`** (Schwelle), **`criteria_extra`** (JSONB-Zusatzparameter), sowie **`target_role`** (Rollenfilter, siehe Frage 7).

**Existierende `criteria_type`-Werte** (Quelle `CRITERIA_TYPES` in `backend/routes/badges.js:9-91`):

| criteria_type | Bedeutung | Datenquelle |
|---|---|---|
| `total_points` | Summe Gottesdienst+Gemeinde >= Wert | `konfi_profiles` |
| `gottesdienst_points` | Gottesdienst-Punkte >= Wert | `konfi_profiles` |
| `gemeinde_points` | Gemeinde-Punkte >= Wert | `konfi_profiles` |
| `both_categories` | beide Bereiche >= Wert | `konfi_profiles` |
| `activity_count` | Anzahl Aktivitaeten + Events | `user_activities` + `event_bookings` |
| `event_count` | Anzahl besuchter Events (alle, `attendance_status='present'`) | `event_bookings` |
| `unique_activities` | verschiedene Aktivitaeten | `user_activities` |
| `specific_activity` | bestimmte Aktivitaet X-mal | `user_activities` + `criteria_extra.required_activity_name` |
| `category_activities` | Aktivitaeten/Events aus Kategorie | `criteria_extra.required_category` |
| `activity_combination` | Kombination mehrerer Aktivitaeten | `criteria_extra.required_activities` |
| `time_based` | X Aktivitaeten in Y Wochen/Tagen | `criteria_extra.days`/`weeks` |
| `streak` | aufeinanderfolgende aktive Wochen | berechnet (ISO-Wochen) |
| `bonus_points` | Anzahl Bonus-Vergaben | `bonus_points` |
| `teamer_year` | aktive Teamer-Jahre (Luecken erlaubt) | `user_activities`+`event_bookings`, nur `target_role='teamer'` |

Im Frontend tauchen in der Gruppierung zusaetzlich `collection` und `yearly` auf (`frontend/src/components/konfi/views/BadgesView.tsx:341-342`), die im Backend KEINE Wertungslogik haben (toter Filter / Altlast).

---

## 2. Badge-Erstellung + Modal

**Backend-Route:** `backend/routes/badges.js:732` `router.post('/')` (nur `requireAdmin`). Validierung verlangt `name`, `icon`, `criteria_type`, `criteria_value` (`badges.js:735`). INSERT inkl. `target_role` (`badges.js:742-749`). Update unter `badges.js:763` (`router.put('/:id')`). Die waehlbaren Typen liefert `GET /criteria-types` (`badges.js:669-670`, gibt `CRITERIA_TYPES` zurueck).

**Frontend-Modal:** `frontend/src/components/admin/modals/BadgeManagementModal.tsx`.
- Laedt Typen ueber `api.get('/admin/badges/criteria-types')` (`BadgeManagementModal.tsx:332`).
- Rollen-Auswahl konfi/teamer via Toggle (`BadgeManagementModal.tsx:789`, `:804`); setzt `target_role`.
- Typ-Filter im UI (`BadgeManagementModal.tsx:1009-1014`):
  - `POINTS_CRITERIA_TYPES` und `time_based`, `streak`, `event_count` werden bei **Teamer ausgeblendet** (`TEAMER_HIDDEN_TYPES`, `BadgeManagementModal.tsx:255`).
  - `teamer_year` wird NUR bei Teamer angezeigt (`BadgeManagementModal.tsx:1013`).

Die Leitung kann aktuell also fuer Konfis alle Punkt-/Aktivitaets-/Zeit-Typen waehlen, fuer Teamer eine reduzierte Liste plus `teamer_year`. Ein Typ "Anzahl besuchter Pflicht-Events" existiert NICHT.

---

## 3. Badge-Wertung (wann/wie wird gewertet)

**Kern-Funktion:** `checkAndAwardBadges(db, userId)` in `backend/routes/badges.js:99-312`. Sie verzweigt anhand der Rolle: Teamer -> `checkAndAwardTeamerBadges` (`badges.js:317-552`), sonst Konfi-Branch (`badges.js:119-307`).

**Trigger:**
1. **Cron / Hintergrund:** `BackgroundService.startBadgeUpdateService` laeuft alle 5 Minuten (`backend/services/backgroundService.js:17-30`), ruft `updateAllUserBadges` -> `checkAndAwardBadges` pro User (`backgroundService.js:75,108`).
2. **Bei Aktionen:** `checkAndAwardBadges` wird zusaetzlich nach Punkte-/Aktivitaets-Vergaben aufgerufen (exportiert via `module.exports.checkAndAwardBadges`, `badges.js:825`).

**Logik pro Typ:** `switch (badge.criteria_type)` im Konfi-Branch (`badges.js:182-289`) bzw. Teamer-Branch (`badges.js:364-533`). Punkte werden aus `konfi_profiles` gelesen, Zaehlungen aus `user_activities`/`event_bookings` (Vorab-Queries `badges.js:152-172`).

**Vergabe:** Erreichte Badge-IDs werden in `insertBadgesAndNotify` (`badges.js:607-639`) per `INSERT INTO user_badges (user_id, badge_id, organization_id)` geschrieben (`badges.js:609`), danach Notification + Push. Schutz gegen Doppelvergabe: `alreadyEarned`-Check (`badges.js:175`, `:356`) + `UNIQUE(user_id, badge_id)`.

Wichtig: Badges werden NUR vergeben (INSERT), nie wieder entzogen. Einmal erreicht = dauerhaft. Das ist relevant fuer Pflicht-Badges, wenn die Leitung den Schwellwert spaeter nach oben korrigiert.

---

## 4. Pflicht-Events

**Es gibt bereits ein Flag:** Spalte **`events.mandatory`** (BOOLEAN). Belege:
- Validierung beim Anlegen/Bearbeiten: `backend/routes/events.js:26`, `:34` (`body('mandatory').optional().isBoolean()`).
- Listen-Query mappt `WHEN e.mandatory THEN 'mandatory'` (`events.js:66`).
- Check-in selektiert `mandatory` (`events.js:270`) und vergibt bei Pflicht-Events KEINE Punkte: `if (event.points > 0 && !event.mandatory ...)` (`events.js:355`). Pflicht-Events sind also bewusst punktneutral.
- Detail-Query listet `mandatory` neben `is_series`, `series_id` (`events.js:525`).

**Anwesenheit/Teilnahme:** ueber `event_bookings.attendance_status`. Wert `'present'` = besucht (z.B. `events.js:351` setzt es beim Check-in; `events.js:468` zaehlt `FILTER (WHERE eb.attendance_status = 'present')`). Buchungsstatus separat in `event_bookings.status` (`confirmed` etc.).

**Serien:** Events koennen Teil einer Serie sein (`is_series`, `series_id`, Index `idx_events_series_id` in `backend/migrations/064_add_missing_indexes.sql:40`). Damit lassen sich z.B. "Pflicht-Samstage" als Serie modellieren.

**Zaehlen besuchter Pflicht-Events pro Konfi:** Aktuell gibt es KEINEN Code-Pfad, der nach `mandatory` filtert. Der bestehende `event_count` zaehlt ALLE Events mit `attendance_status='present'` ohne Pflicht-Filter (`badges.js:160`):
```sql
SELECT COUNT(*) FROM event_bookings WHERE user_id=$1 AND attendance_status='present' AND organization_id=$2
```
Eine Zaehlung "nur Pflicht-Events" waere mit einem JOIN auf `events e ON eb.event_id=e.id AND e.mandatory=true` trivial machbar -- die Daten sind vollstaendig vorhanden, es fehlt nur der Kriterium-Typ.

---

## 5. Prozentuale Fortschrittsanzeige (BUG)

**Wo berechnet:** Der Fortschritt wird im **Backend** in `backend/routes/konfi.js:882-1172` (`GET /konfi/badges`) berechnet, NICHT im Frontend. Pro Badge wird ein `progress`-Objekt `{ current, target, percentage }` aufgebaut (`konfi.js:918`), am Ende `percentage = Math.min((current/target)*100, 100)` (`konfi.js:1138`).

**Wo angezeigt:** Frontend mappt `badge.progress?.percentage` -> `progress_percentage` und `badge.progress?.current` -> `progress_points` in `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx:132-133, 166-167`. Anzeige in `frontend/src/components/konfi/views/BadgesView.tsx:244,257,548,624` (Prozent-Ring + "X% - In Arbeit").

### Hypothesen zur Ursache (konkret)

**Hypothese A (Hauptursache) -- fehlende `criteria_type`-Faelle im Backend-Switch.**
Der Progress-`switch` in `konfi.js:921-1136` behandelt: `total_points`, `gottesdienst_points`, `gemeinde_points`, `both_categories`, `activity_count`, `unique_activities`, `specific_activity`, `category_activities`, `activity_combination`, `bonus_points`, `streak`, `time_based`.
**Fehlend:** `event_count` und `teamer_year` (und alle kuenftigen neuen Typen).
Fuer ein `event_count`-Badge bleibt `progress.current` auf dem Init-Wert `0` (`konfi.js:918`), also `percentage = 0`. Das Badge zeigt dauerhaft "0% - In Arbeit", obwohl der Konfi Events besucht hat. -> Beleg: kein `case 'event_count'` zwischen `konfi.js:921` und `konfi.js:1136`.

**Hypothese B -- `criteria_extra`-Schluessel-Mismatch zwischen Wertung und Progress.**
Bei `specific_activity` nutzt die WERTUNG den Namen `criteria.required_activity_name` (`badges.js:205`), die PROGRESS-Berechnung dagegen `extraData.activity_id` (`konfi.js:992`). Analog `activity_combination`: Wertung nutzt `required_activities` (Namen, `badges.js:216`), Progress nutzt `activity_ids` (`konfi.js:1039`). Da das Modal die Extra-Felder als Namen speichert, liefert die Progress-Query `0` -> Prozent bleibt 0, obwohl Fortschritt da ist. -> Belege: `konfi.js:992` vs. `badges.js:205`; `konfi.js:1039` vs. `badges.js:216`.

**Hypothese C -- toter Frontend-Fallback.**
`KonfiBadgesPage.tsx:135` hat einen Fallback `if (!badge.progress && !isEarned) { ... }`, der NIE greift, weil das Backend `progress` IMMER setzt (mind. das Init-Objekt aus `konfi.js:918`). Der Fallback deckt zudem nur Punkt-Typen ab. Damit gibt es keinen Selbstheilungs-Pfad fuer die in A/B genannten Luecken.

**Hypothese D -- Division/`target=0`.**
`target = badge.criteria_value || 1` (`konfi.js:918`) faengt `0`/`null` ab; bei korrekt gesetztem `criteria_value` unkritisch. Eher nachrangig.

**Fazit:** Der sichtbare "Prozent funktioniert nicht"-Effekt entsteht primaer durch **A** (event_count/teamer_year ohne Progress-Case) und **B** (Extra-Feld-Mismatch bei specific_activity/activity_combination). Beide fuehren zu `progress.current = 0` trotz realem Fortschritt.

---

## 6. Teamer-Jahre-Logik

**Existiert bereits** als `criteria_type = 'teamer_year'` -- Wertung in `backend/routes/badges.js:405-466`. Die geforderte kumulative, Luecken-ueberspringende Logik ist dort schon umgesetzt:
- Startjahr ermitteln: zuerst `user_role_history` (`badges.js:413-419`), sonst aelteste Teamer-Aktivitaet `MIN(ua.completed_date)` (`badges.js:426-435`).
- Alle Aktivitaets-/Event-Daten sammeln (`badges.js:444-453`), Jahre in ein `Set` (`badges.js:456-461`), nur Jahre `>= startYear` zaehlen (`badges.js:463`), Vergleich gegen `criteria_value` (`badges.js:464`).
- Kommentar `badges.js:406-407` bestaetigt: "Zaehlt nur Jahre mit mind. 1 Aktivitaet/Event. Luecken erlaubt."

**Datenquellen fuer "begleitete Aktion pro Jahr":**
- `user_activities.completed_date` (JOIN `activities` mit `target_role='teamer'`) -- `badges.js:445-447`.
- `event_bookings` mit `attendance_status='present'` JOIN `events.event_date` -- `badges.js:449-451`.
Beide liefern Datumswerte -> Jahr extrahierbar. Die kumulative Luecken-Logik ist mit vorhandenen Daten vollstaendig machbar und bereits implementiert.

**Offene Schwaeche / Risiko:**
1. **`user_role_history` existiert nicht** als Tabelle. Sie wird referenziert (`badges.js:414`), ist aber nirgends per `CREATE TABLE`/`INSERT` definiert (keine Treffer in Migrations/Routes ausser dem lesenden Query). Der `try/catch` (`badges.js:412-422`) faengt das ab und faellt auf die aelteste Teamer-Aktivitaet zurueck -- funktioniert, aber das "Startjahr" ist dann das erste Aktionsjahr, nicht das echte Promotion-Jahr.
2. **`users.teamer_since`** (Migration `064_consolidate_inline_schemas.sql:108`, DATE) existiert und wird in `wrapped.js:353` genutzt, aber NICHT in der `teamer_year`-Badge-Logik. Das waere die naheliegendere, vorhandene Quelle fuer das Startjahr statt der nicht-existenten `user_role_history`.
3. **Kein Progress-Case** fuer `teamer_year` (siehe Frage 5, Hypothese A) -> Prozent-Anzeige fehlt.

---

## 7. Teamer- vs. Konfi-Unterscheidung

**Feld:** `custom_badges.target_role` (`'konfi'` Default, oder `'teamer'`). Belege: Schema `globalSetup.js:198`; Konfi-Badges-Query filtert `target_role='konfi'` (`badges.js:139`); Teamer-Query `target_role='teamer'` (`badges.js:320`).

**Wertung getrennt:** `checkAndAwardBadges` prueft die Rolle des Users (`badges.js:106`, `role_name === 'teamer'`) und ruft entweder den Teamer- oder Konfi-Branch. Ein Konfi kann keine Teamer-Badges bekommen und umgekehrt -- die jeweils andere Badge-Menge wird gar nicht erst geladen.

**UI:** Das Modal setzt `target_role` ueber den Rollen-Toggle und blendet typ-spezifisch aus (`BadgeManagementModal.tsx:1009-1014`). `GET /konfi/badges` liefert nur `target_role='konfi'` (`konfi.js:906`).

Badges sind also bereits sauber rollenspezifisch. Ein neues Pflicht-Anwesenheits-Badge waere `target_role='konfi'`, ein Teamer-Jahre-Badge `target_role='teamer'` (existiert).

---

## Luecken + Empfehlungen fuer Phase 116

### A) Pflicht-Anwesenheits-Badges (NEU)
**Was fehlt:**
- Neuer `criteria_type`, z.B. `mandatory_event_count`, in `CRITERIA_TYPES` (`badges.js:9-91`).
- Wertungs-Case im Konfi-Branch (`badges.js:182-289`): COUNT aus `event_bookings eb JOIN events e ON eb.event_id=e.id WHERE eb.attendance_status='present' AND e.mandatory=true AND eb.user_id=$1 AND eb.organization_id=$2`. Optional Aktivitaeten mit Pflicht-Charakter mitzaehlen, falls gewuenscht (Inhaber klaeren).
- Progress-Case in `konfi.js` (gleiche COUNT-Query) -> behebt zugleich Prozent fuer diesen Typ.
- Modal: Typ in der Konfi-Auswahl freischalten (`BadgeManagementModal.tsx:1009`), `getValueLabel` (`:713`) + Default-Farbe (`:217`) ergaenzen.
- KEINE Schema-Aenderung noetig: `events.mandatory` + `event_bookings.attendance_status` reichen. Nur absolute Anzahl (kein Prozent gegen Gesamtzahl) -- deckt sich mit der vorhandenen COUNT-Logik.

### B) Teamer-Jahre-Badges (TEILWEISE VORHANDEN)
**Was existiert:** `teamer_year`-Wertung inkl. Luecken-Logik (`badges.js:405-466`).
**Was fehlt / zu fixen:**
- Startjahr-Quelle korrigieren: `users.teamer_since` (existiert, `064_consolidate_inline_schemas.sql:108`) statt nicht-existenter `user_role_history` nutzen -- oder `user_role_history` tatsaechlich anlegen + bei Promotion befuellen (`konfi-management.js` Promote-Pfad).
- Progress-Case `teamer_year` in `konfi.js` bzw. der Teamer-Badges-Progress-Route ergaenzen (aktuell liefert `GET /konfi/badges` nur Konfi-Badges; pruefen, ob Teamer-Badges ueberhaupt einen Progress-Endpoint haben -> `frontend/src/components/teamer/...BadgesView` checken).

### C) Prozent-Bug (BLOCKER fuer beide neuen Typen)
- **Hauptfix:** Fehlende `case`-Zweige in `backend/routes/konfi.js:921-1136` ergaenzen (`event_count`, `teamer_year`, kuenftig `mandatory_event_count`). Ohne diese bleibt jeder neue Typ bei 0%.
- **Zweitfix:** Extra-Feld-Mismatch beheben -- Progress-Query fuer `specific_activity` (`konfi.js:992`, nutzt `activity_id`) und `activity_combination` (`konfi.js:1039`, nutzt `activity_ids`) auf dieselben Schluessel umstellen, die die Wertung nutzt (`required_activity_name` / `required_activities`, `badges.js:205,216`).
- **Aufraeumen:** Toten Frontend-Fallback (`KonfiBadgesPage.tsx:135`) und tote Filter `collection`/`yearly` (`BadgesView.tsx:341-342`) bewerten.

### D) Fragen fuer die Discuss-Phase (Inhaber)
1. Sollen Pflicht-**Aktivitaeten** (nicht nur Pflicht-Events) mitzaehlen, oder ausschliesslich Events mit `mandatory=true`? Aktuell gibt es kein `mandatory`-Flag auf `activities`.
2. Beim spaeteren Anheben des Schwellwerts: bereits vergebene Pflicht-Badges bleiben bestehen (kein Entzug). Ist das gewollt, oder soll bei Schwellwert-Erhoehung neu bewertet/entzogen werden?
3. Teamer-Jahre-Startjahr: `teamer_since` (Promotion-Datum) oder erstes Aktionsjahr? Beeinflusst Zaehlung bei frisch promoteten Teamer:innen.
4. Soll "Pflicht-Anwesenheit" auch ueber Serien (`series_id`) aggregiert dargestellt werden (z.B. "10 von 12 Pflicht-Samstagen"), oder reicht der reine Gesamtzaehler ueber alle Pflicht-Events?
5. Sollen Pflicht-Events trotz `mandatory`-Punktneutralitaet (`events.js:355`) fuer Badges zaehlen? (Antwort vermutlich ja -- klarstellen, da Punkte und Badge-Zaehlung hier entkoppelt waeren.)
