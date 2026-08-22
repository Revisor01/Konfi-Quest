# CLAUDE.md - Konfipoints/Konfi Quest System

## KRITISCHE REGELN FUER CLAUDE CODE

1. **RBAC-Struktur verwenden** - Alte `admins`/`konfis` Tabellen und `points.gottesdienst` Struktur sind deprecated
2. **Deutsche Entwicklungssprache verwenden**
3. **KEINE UNICODE EMOJIS VERWENDEN!!!** - Keine Emojis in Code, UI oder Texten!
   - VERBOTEN: Alle Unicode Emojis (Smileys, Symbole, etc.)
   - ERLAUBT: IonIcon mit Icons aus ionicons/icons (auch outline Varianten)
   - ERLAUBT: Line Icons und Icon Fonts
   - Das gilt für ALLE Dateien: .tsx, .ts, .js, .jsx, Kommentare, Strings, ÜBERALL!
4. **CHANGELOG FORTLAUFEND PFLEGEN** - Bei JEDEM Commit, der Nutzer:innen
   betrifft, im selben Commit einen Eintrag in `CHANGELOG.md` ergänzen.
   NICHT bis zum Release warten!
   - Kein passender Versions-Abschnitt da? Dann oben `## [Unreleased] - <Version>`
     anlegen und dort eintragen.
   - Keep-a-Changelog-Kategorien: Hinzugefügt / Geändert / Behoben / Sonstiges
   - Ein knapper Satz pro Punkt, aus Nutzersicht ("Termine mit Anmeldungen
     lassen sich wieder löschen")
   - NIEMALS: Build-Nummern, Framework-Namen, Dateinamen, Commit-Hashes,
     Infrastruktur. Das gehört in die Commit-Message.
   - Reine Interna (Refactoring, Tests, CI) nur unter "Sonstiges", wenn überhaupt
5. **ECHTE UMLAUTE VERWENDEN** - Immer ü, ö, ä, ß statt ue, oe, ae, ss!
   - RICHTIG: für, Glückwunsch, bestätigt, Größe
   - FALSCH: fuer, Glueckwunsch, bestaetigt, Groesse
   - Das gilt besonders für Push-Nachrichten, UI-Texte und Meldungen!

---

## Systemarchitektur

### Backend: Node.js Express mit RBAC System
- **Database**: PostgreSQL mit RBAC-Struktur (Docker Container) -- Alle 15 Routes vollständig auf PostgreSQL migriert
- **Authentication**: JWT mit `verifyTokenRBAC` middleware
- **Port**: 5000 (Docker: 8623)
- **API Base**: https://konfi-quest.de/api
- **Routes Directory**: backend/routes/

### Frontend: React 19 + Ionic 8 + TypeScript
- **Framework**: React 19 mit Ionic React 8
- **Build**: Vite 5.2
- **State**: React Context (`AppContext`)
- **Dev Port**: 5173

---

## RBAC Datenbankstruktur

### Kern-Tabellen:
```sql
-- Alle Benutzer (Admin + Konfis)
users: id, display_name, username, role_id, organization_id

-- Konfi-spezifische Daten
konfi_profiles: user_id, gottesdienst_points, gemeinde_points, jahrgang_id

-- Aktivitäten
konfi_activities: konfi_id, activity_id, completed_date, admin_id

-- Bonus Points
bonus_points: konfi_id, points, type, description, admin_id

-- Badges
konfi_badges: konfi_id, badge_id, awarded_date

-- Events
event_bookings: user_id, event_id, status, booking_date

-- Chat System
chat_rooms: id, name, type, jahrgang_id, created_by, organization_id
chat_messages: id, room_id, user_id, user_type, content, created_at
chat_participants: id, room_id, user_id, user_type, joined_at
```

---

## DREI Ansichten — der häufigste Stolperstein

Jede Rolle hat einen EIGENEN Komponentenbaum:
`components/admin/` (Leitung, 17 Seiten) · `components/teamer/` (8) ·
`components/konfi/` (6). Chat ist die Ausnahme: `components/chat/` gilt für alle.

**Fast jede Funktion existiert deshalb mehrfach.** Wer eine Änderung nur an
einer Stelle macht, hat sie für zwei Drittel der Nutzer:innen NICHT gemacht:

- Dashboard: admin 1 · teamer 1 · konfi 3 Dateien
- Challenges: admin 2 · teamer 1 · konfi 2
- Events, Profil, Abzeichen: je 1–2 pro Rolle

**Vor JEDER UI-Änderung:** in allen drei Bäumen nachsehen, ob es die Stelle
dort auch gibt — und die Änderung dort mitmachen oder bewusst begründen,
warum nicht.

Zwei reale Fälle (22.08.2026):
- Der Reiter-Umbau bei Challenges existierte nur in der Konfi-Ansicht. Die
  Leitung sah weiter zwei gestapelte Listen und meldete, "der Umbau fehlt".
- Die Tageslosung wird in `DashboardView.tsx` (prüft den Schalter) UND in
  `KonfiDashboardPage.tsx` (prüft ihn nicht) geladen — der Schalter griff
  deshalb nur halb.

Dasselbe gilt im Backend: `routes/konfi.js` und `routes/teamer.js` haben
eigene Endpunkte für dieselbe Sache (z.B. beide ein `/tageslosung`). Ein Fix
in einer Datei ist selten der ganze Fix.

## Typografie und Farben aus der App übernehmen

Für alles, was nach Konfi Quest aussehen soll (Doku-Seiten, Screenshots,
Exporte), gilt `frontend/src/theme/variables.css` als Quelle:
- **Bebas Neue** für Überschriften und Displays (mit Letterspacing, wie in
  `.app-auth-hero__title`), **Plus Jakarta Sans** für Fließtext.
- Bereichsfarben statt frei gewählter: `--app-color-chat` (#06b6d4),
  `--app-color-events` (#dc2626), `--app-color-konfis` (#5b21b6),
  `--app-color-teamer` (#be185d), `--app-color-activities` (#047857).

## Modals korrekt verwenden

### IMMER so (useIonModal Hook):
```typescript
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => {
    dismissModal();
    loadData(); // Daten neu laden
  }
});

// Öffnen
presentModal({ presentingElement: presentingElement });
```

### NIEMALS `<IonModal isOpen={state}>` verwenden!

---

## Entwicklungskommandos

### Backend starten:
```bash
cd backend && npm start
```

### Frontend development:
```bash
cd frontend && npm run dev
```

### Deployment:
```bash
ssh root@server.godsapp.de
cd /opt/Konfi-Quest/
git pull && docker-compose down && docker-compose up -d --build
```

### Datenbankzugriff:
```bash
ssh root@server.godsapp.de "docker exec -it konfi-quest-db-1 psql -U konfi_user -d konfi_db"
```

---

## System Status

### Funktioniert:
- RBAC System vollständig migriert
- Alle 15 Routes auf PostgreSQL (activities, auth, badges, categories, chat, events, jahrgaenge, konfi-managment, konfi, levels, notifications, organizations, roles, settings, users)
- Chat-System mit organization_id Filterung (Chat-Erstellung nur innerhalb derselben Organisation)
- Badge Counts in Übersicht und Details
- Activity/Bonus CRUD Operations
- Admin Konfi Management
- Punkte-Anzeige korrekt
- Modal System mit useIonModal
- Event-Booking mit Timeslots und Waitlist

---

**WICHTIG**: Dieses System ist produktiv. Alle Änderungen müssen der RBAC-Struktur folgen!
