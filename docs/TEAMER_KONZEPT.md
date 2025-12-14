# Teamer-System Konzept

## Übersicht

Das Teamer-System ermöglicht es, Konfis nach ihrer Konfirmation zu aktiven Teamern zu machen. Sie behalten ihre Badges aus der Konfizeit und können neue Teamer-Badges sammeln.

---

## 1. Rollenmodell

```
Konfi  -->  Teamer  -->  Admin
              |
        (behält Badges aus Konfizeit)
```

### Teamer-Rolle
- Erweiterter Zugriff auf Events-Tab (Teamer-Ansicht)
- Kann sich selbst zu Events buchen/abmelden
- Absagen NUR mit Begründung möglich
- Eigene Badge-/Level-Progression

---

## 2. Datenbank-Änderungen

### Bestehende Strukturen (werden wiederverwendet)
- `event_categories` - Kategorien existieren bereits
- `custom_badges` - Badge-System existiert bereits
- `users` - Rollen-System existiert

### Neue/Erweiterte Felder

#### Tabelle: `events`
```sql
ALTER TABLE events ADD COLUMN teamer_only BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN teamer_slots INTEGER DEFAULT 0;
-- teamer_slots > 0 = Helfer werden benötigt
```

#### Tabelle: `event_teamer_bookings`
```sql
CREATE TABLE event_teamer_bookings (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  teamer_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'confirmed', -- confirmed, cancelled
  cancellation_reason TEXT,
  booked_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP
);
```

#### Tabelle: `teamer_profiles`
```sql
CREATE TABLE teamer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  promoted_from_konfi_id INTEGER,
  promoted_at TIMESTAMP DEFAULT NOW(),
  level INTEGER DEFAULT 1
);
```

#### Tabelle: `archived_konfi_badges`
```sql
CREATE TABLE archived_konfi_badges (
  id SERIAL PRIMARY KEY,
  teamer_id INTEGER REFERENCES users(id),
  badge_id INTEGER,
  badge_name VARCHAR(255),
  awarded_date TIMESTAMP
);
```

---

## 3. Event-Modi

### Modus A: Nur-Teamer-Event
- `teamer_only = TRUE`
- Sichtbar nur für Teamer und Admins
- Teamer melden sich direkt an
- Beispiele: Teamertreff, Planungssitzung, Schulung

### Modus B: Konfi-Event mit Teamer-Unterstützung
- `teamer_only = FALSE` UND `teamer_slots > 0`
- Konfis melden sich als Teilnehmer an
- Separate Helfer-Slots für Teamer
- Push-Benachrichtigung: "Für [Event] werden Helfer gesucht"

### Modus C: Normales Konfi-Event (wie bisher)
- `teamer_only = FALSE` UND `teamer_slots = 0`
- Keine Teamer-Funktionalität

---

## 4. Teamer-Badge-Progression

### Konzept
Das bestehende Badge-System wird für Teamer erweitert. Kategorien können einem Teamer-Badge zugeordnet werden.

### Ablauf
1. Teamer meldet sich zu Event "Konfi-Übernachtung" (Kategorie: Übernachtung)
2. Event findet statt / wird als durchgeführt markiert
3. System: Badge-Fortschritt +1 für zugeordneten Badge
4. Bei Schwelle: Stufen-Upgrade (Bronze -> Silber -> Gold)
5. Push an Teamer

### Beispiel Badge-Zuordnung

| Event-Kategorie | Teamer-Badge | Stufen |
|-----------------|--------------|--------|
| Übernachtung | Übernachtungs-Begleiter | 1 / 3 / 5 |
| Gottesdienst | Gottesdienst-Helfer | 5 / 15 / 30 |
| Jugendreise | Reise-Veteran | 1 / 2 / 3 |
| Konfizeit | Konfizeit-Begleiter | 1 / 3 / 5 |

---

## 5. UI-Änderungen

### A. Events-Tab für Teamer

```
+---------------------------------------+
| Events                                |
+---------------------------------------+
|                                       |
| -- Meine Anmeldungen ---------        |
| [*] Teamertreff                       |
|     15. Jan | Angemeldet              |
|                                       |
| [*] Konfi-Übernachtung                |
|     22. Jan | Als Helfer              |
|                                       |
| -- Helfer gesucht ------------        |
| [*] Jugendgottesdienst                |
|     28. Jan | 2/4 Helfer              |
|     [Anmelden]                        |
|                                       |
| -- Teamer-Events -------------        |
| [*] Planungstreffen                   |
|     05. Feb | [Anmelden]              |
|                                       |
+---------------------------------------+
```

### B. Event-Detail (Admin) - Neue Sektion

```
+---------------------------------------+
| -- Teamer-Helfer (2/4) --------       |
| [*] Sarah                             |
|     Level 3 | Angemeldet              |
|                                       |
| [*] Jonas                             |
|     Level 2 | Angemeldet              |
|                                       |
| 2 Plätze frei                         |
| [Teamer benachrichtigen]              |
|                                       |
| -- Teamer-Absagen -------------       |
| [*] Tim                               |
|     15.01. | "Terminkonflikt"         |
+---------------------------------------+
```

### C. Event-Modal (Admin) - Neue Optionen

```
+---------------------------------------+
| -- Teamer-Optionen ---------------    |
|                                       |
| [ ] Nur für Teamer sichtbar           |
|                                       |
| [x] Teamer-Unterstützung benötigt     |
|     Anzahl Helfer: [4]                |
|                                       |
| [ ] Push an alle Teamer senden        |
+---------------------------------------+
```

### D. Teamer-Profil

```
+---------------------------------------+
| Mein Profil                           |
+---------------------------------------+
|         [Avatar]                      |
|      Sarah Müller                     |
|   Level 3 | Erfahrene Teamerin        |
+---------------------------------------+
|                                       |
| -- Teamer-Badges -----------------    |
| [*] Übernachtungs-Begleiter           |
|     Silber | 3/5 für Gold             |
|     [========--]                      |
|                                       |
| [*] Gottesdienst-Helfer               |
|     Bronze | 8/15 für Silber          |
|     [=====-----]                      |
|                                       |
| -- Aus meiner Konfizeit ----------    |
| [*] Fleißiger Gottesdienstbesucher    |
| [*] Gemeinde-Champion                 |
| [*] Event-König                       |
+---------------------------------------+
```

### E. Konfi-Detail (Admin) - Neuer Button

```
+---------------------------------------+
| Max Mustermann                        |
| Jahrgang 2024                         |
+---------------------------------------+
| ...                                   |
+---------------------------------------+
| [Zu Teamer machen]                    |
+---------------------------------------+
```

---

## 6. Absage mit Begründung

Teamer können Anmeldungen nur mit Pflicht-Begründung stornieren:

```
+---------------------------------------+
| Anmeldung zurückziehen?               |
+---------------------------------------+
|                                       |
| Bitte gib einen Grund an:             |
| +-----------------------------------+ |
| | Terminkonflikt mit Arbeit         | |
| +-----------------------------------+ |
|                                       |
| Diese Information wird an die         |
| Verantwortlichen weitergeleitet.      |
|                                       |
|    [Abbrechen]    [Absagen]           |
+---------------------------------------+
```

---

## 7. Push-Benachrichtigungen

| Typ | Auslöser | Text |
|-----|----------|------|
| Neues Event | Teamer-Event erstellt | "Neues Event: [Name] am [Datum]" |
| Helfer gesucht | teamer_slots > 0 | "Für [Event] werden Helfer gesucht!" |
| Erinnerung | 1 Tag vor Event | "Morgen: [Event] um [Uhrzeit]" |
| Badge-Fortschritt | Stufe erreicht | "[Badge] in [Stufe] erreicht!" |
| Level-Up | Neues Level | "Du bist jetzt Level [X]!" |
| Willkommen | Konfi -> Teamer | "Willkommen im Team!" |

---

## 8. Workflow: Konfi wird Teamer

1. Admin öffnet Konfi-Profil
2. Klickt "Zu Teamer machen"
3. Bestätigungs-Dialog
4. System:
   - Ändert Rolle zu "teamer"
   - Erstellt teamer_profiles Eintrag
   - Kopiert Badges nach archived_konfi_badges
   - Sendet Willkommens-Push
5. Teamer hat ab sofort Zugriff auf Teamer-Events-Ansicht

---

## 9. API-Endpunkte (Neu)

```
POST   /api/admin/konfis/:id/promote-to-teamer
GET    /api/teamer/events
POST   /api/teamer/events/:id/book
DELETE /api/teamer/events/:id/book  (mit body: { reason: "..." })
GET    /api/teamer/profile
GET    /api/teamer/badges
POST   /api/events/:id/complete  (löst Badge-Fortschritt aus)
```

---

## 10. Implementierungs-Phasen

### Phase 1: Grundstruktur
- [ ] Rolle "teamer" in users
- [ ] teamer_profiles Tabelle
- [ ] archived_konfi_badges Tabelle
- [ ] "Zu Teamer machen" Button + Workflow

### Phase 2: Events für Teamer
- [ ] Felder teamer_only und teamer_slots in events
- [ ] event_teamer_bookings Tabelle
- [ ] Teamer-Events-Ansicht (Frontend)
- [ ] Teamer-Buchung und Absage mit Grund

### Phase 3: Helfer-System
- [ ] Teamer-Slots bei Konfi-Events (Event-Modal)
- [ ] Helfer-Anmeldung (Teamer-Ansicht)
- [ ] Admin-Ansicht für Teamer-Helfer
- [ ] Push "Helfer gesucht"

### Phase 4: Badge-Progression
- [ ] Kategorie -> Badge Zuordnung (Admin)
- [ ] Automatischer Fortschritt nach Event
- [ ] Teamer-Profil mit Badge-Anzeige
- [ ] Push-Benachrichtigungen für Badges

---

# Konfi-Jahr Wrapped

## Konzept

Zur Konfirmation erhält jeder Konfi einen personalisierten Jahresrückblick - inspiriert von Spotify Wrapped.

## Inhalte

### Statistiken
- Gesammelte Punkte (Gottesdienst + Gemeinde)
- Besuchte Events (Anzahl + Highlights)
- Verdiente Badges
- Erreichte Level
- Ranking im Jahrgang (optional)

### Highlights
- "Dein erstes Badge war..."
- "Dein aktivster Monat war..."
- "Du hast X Gottesdienste besucht"
- "Deine Lieblings-Event-Kategorie war..."

### Visualisierung
- Animierte Slides (wie Spotify)
- Shareable als Bild
- PDF-Export für Konfirmanden-Mappe

## UI-Flow

```
+---------------------------------------+
|          Dein Konfi-Jahr              |
|             2024/2025                 |
+---------------------------------------+
|                                       |
|              [Weiter]                 |
+---------------------------------------+

        |
        v

+---------------------------------------+
|        Du hast 847 Punkte             |
|           gesammelt!                  |
|                                       |
|       Das sind mehr als 73%           |
|       deines Jahrgangs                |
+---------------------------------------+

        |
        v

+---------------------------------------+
|      Du hast 12 Events besucht        |
|                                       |
|   Dein Highlight:                     |
|   Konfi-Übernachtung im März          |
+---------------------------------------+

        |
        v

+---------------------------------------+
|       Deine Badges                    |
|                                       |
|   [*] Fleißiger Gottesdienstbesucher  |
|   [*] Event-König                     |
|   [*] Gemeinde-Champion               |
|   [*] Level 5 erreicht                |
+---------------------------------------+

        |
        v

+---------------------------------------+
|     Danke für deine Konfizeit!        |
|                                       |
|   [Als Bild speichern]                |
|   [PDF herunterladen]                 |
|   [Teilen]                            |
|                                       |
|   Möchtest du Teamer werden?          |
|   [Ja, ich möchte Teamer werden]      |
+---------------------------------------+
```

## Technische Umsetzung

### Datenquellen
- `konfi_profiles` - Punkte
- `konfi_activities` - Aktivitäten mit Datum
- `event_bookings` - Event-Teilnahmen
- `konfi_badges` - Verdiente Badges

### Berechnung
- Automatisch generiert basierend auf Jahrgang-Zeitraum
- Vergleichswerte aus Jahrgangs-Durchschnitt
- Highlights durch Analyse der Aktivitäten

### Verfügbarkeit
- Freigeschaltet X Wochen vor Konfirmation
- Oder manuell durch Admin aktivierbar
- Link zum Wrapped im Konfi-Dashboard

---

## Zusammenfassung

| Feature | Aufwand | Priorität |
|---------|---------|-----------|
| Teamer-Rolle + Promotion | Mittel | Hoch |
| Teamer-Events-Ansicht | Mittel | Hoch |
| Helfer-System | Mittel | Hoch |
| Teamer-Badge-Progression | Gering* | Mittel |
| Konfi-Jahr Wrapped | Hoch | Mittel |

*Gering weil bestehendes Badge-System wiederverwendet wird
