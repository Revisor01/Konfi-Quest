# Phase 42: Material - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Datei-Uploads und Material-Bereich fuer Teamer:innen. Admin verwaltet Material (CRUD) mit Dateien, Tags und Event-Verknuepfung. Teamer:innen sehen alle Materialien ihrer Organisation, koennen filtern, suchen und Dateien oeffnen. Material erscheint auch in Event-Details (Admin + Teamer).

</domain>

<decisions>
## Implementation Decisions

### Upload-Berechtigung & Verwaltung
- Nur Admin darf Material hochladen, bearbeiten und loeschen
- Admin kann Titel, Beschreibung und Metadaten nachtraeglich bearbeiten (Loeschen + Bearbeiten)
- Eigene Admin-Unterseite "Material verwalten" (wie Kategorien/Jahrgaenge — Button in AdminSettingsPage)
- Swipe-to-Delete in der Admin-Materialliste
- Klick oeffnet Material zum Ansehen/Bearbeiten (Admin soll eigenes Material auch anschauen koennen)
- Erstellen/Bearbeiten als Card-Modal (useIonModal, wie Kategorien-Pattern)

### Material-Struktur
- Ein Material-Eintrag hat: Titel (Pflicht), Beschreibung (optional), Tags, optionale Event-Verknuepfung
- Material kann MEHRERE Dateien als Paket enthalten (kein Limit fuer Anzahl)
- Material kann auch OHNE Datei existieren (reiner Text/Methoden-Steckbrief)
- Event-Verknuepfung: Material kann optional einem Event zugeordnet werden
- Verknuepftes Material erscheint im Event-Detail (sowohl Admin- als auch Teamer-Ansicht)
- Jahrgang optional als Info-Tag zuordenbar (alle Teamer:innen sehen trotzdem alles)

### Tag-System
- Admin definiert Tags vorab (keine freie Eingabe, konsistent)
- Tag-Verwaltung (CRUD) direkt in der Admin-Material-Seite, nicht in Einstellungen
- Tags dienen der Filterung und Strukturierung (z.B. "Spiele", "Andachten", "Methoden", "Formulare")

### Sichtbarkeit
- Material ist fuer ALLE Teamer:innen der Organisation sichtbar (keine Jahrgang-Einschraenkung)
- Konfis haben KEINEN Zugang zum Material-Bereich
- Teamer:innen koennen auch nachtraeglich auf Material zugreifen

### Teamer Material-Tab (Listen-Layout)
- Listen-Layout mit globalem CSS (app-list-item Pattern)
- Solid Icons, Farben, Corner Badges oben rechts (bis zu 2 nebeneinander)
- Tag-Filter (Chips oben) + Suchleiste zum Durchsuchen von Titeln/Beschreibungen
- Klick navigiert zu eigener Detail-Seite (nicht inline, nicht Modal)
- Detail-Seite zeigt: Titel, Beschreibung, Tags, Event-Link, Dateiliste
- Dateien oeffnen ueber FileOpener (wie im Chat) — Bilder, PDFs, Dokumente. Kein Inline-Preview

### Admin Material-Verwaltung
- Segmente: "Mit Event" / "Ohne Event" (oder aehnlich) + Tag-Filter + Suche
- Gleiche Listenansicht wie Teamer, aber mit Swipe-to-Delete und Bearbeiten-Moeglichkeit
- Admin sieht verknuepftes Material auch in der Admin-Event-Detail-Ansicht

### Datei-Limits
- Max. 20MB pro Datei (groesser als Chat mit 5MB, fuer umfangreichere PDFs/Praesentationen)
- Kein Limit fuer Anzahl Dateien pro Material-Eintrag
- Gleiche MIME-Type-Whitelist wie Chat (Bilder, PDF, Video, Audio, Office-Dokumente)

### Farbe
- Amber/Gold (#d97706) als Material-Akzentfarbe
- Hebt sich klar ab von Admin-Blau, Konfi-Lila, Teamer-Rose, Chat-Teal, Events-Orange

### Claude's Discretion
- DB-Schema fuer Material (Tabellen, Relationen, Indizes)
- API-Endpunkte (REST-Design, Routen-Struktur)
- Multer-Konfiguration fuer 20MB (eigener Upload-Handler)
- Genauer Aufbau der Admin-Material-Seite und des Card-Modals
- Corner-Badge-Belegung in der Materialliste (z.B. Dateianzahl, Event-Badge)
- Segment-Labels in der Admin-Verwaltung
- Detail-Seiten-Layout fuer Teamer

</decisions>

<specifics>
## Specific Ideas

- Material ist mehr als eine Dateiablage — es sind Programme, Methoden, Spielesammlungen, Andachten. Struktur und Auffindbarkeit sind wichtig
- Event-Verknuepfung zentral: "Programm Konfi-Freizeit" gehoert zum Event "Konfi-Freizeit" und erscheint dort
- Admin-Seite: Button in AdminSettingsPage (wie Kategorien/Jahrgaenge), eigene Unterseite, Card-Modal fuer CRUD
- Swipe-to-Delete, Klick zum Ansehen/Bearbeiten — Admin muss sehen was er erstellt hat
- "Das muss klar und gut strukturiert sein" — Tag-System + Event-Verknuepfung + Suche als Strukturierungsmittel
- Alles von Anfang an im bestehenden Look: globale CSS-Klassen, Solid Icons, Corner Badges

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TeamerMaterialPage.tsx`: Existiert als EmptyState-Platzhalter, Route `/teamer/material` konfiguriert
- `ChatRoom.tsx`: FileOpener-Pattern fuer Datei-Anzeige (Bilder, PDF, Dokumente)
- `chatUpload` (server.js): multer-Config mit MD5-Hashing, MIME-Whitelist — als Vorlage fuer Material-Upload (anpassen auf 20MB)
- `AdminSettingsPage.tsx`: Button-Pattern fuer Unterseiten (Kategorien, Jahrgaenge, Zertifikate)
- `useIonModal`: Bestehendes Card-Modal-Pattern fuer CRUD
- Globale CSS-Klassen in `variables.css`: Listen-Styles, Corner Badges, Icon-Farben
- `IonItemSliding` + `IonItemOption`: Swipe-to-Delete Pattern in Admin-Listen

### Established Patterns
- Listen: `app-list-item` CSS-Klassen, Solid Icons 32px mit Top-Alignment
- Corner Badges: Bis zu 2 nebeneinander oben rechts (z.B. TEAM Badge in Events)
- Admin-Unterseiten: Button in Settings -> eigene IonPage mit IonBackButton
- Card-Modal: `useIonModal` mit `presentingElement`, `onClose`/`onSuccess` Callbacks
- File-Download: `/api/chat/files/:filename` Pattern mit Path-Traversal-Schutz
- MD5-Dateinamen: Verschluesselte Dateinamen auf dem Server, Original-Name in DB

### Integration Points
- `AdminSettingsPage.tsx`: Neuer Button "Material verwalten"
- `AdminEventDetailView.tsx`: Neue Sektion "Material" bei verknuepften Dateien
- `TeamerEventsPage.tsx`: Material-Sektion im Event-Detail bei verknuepften Dateien
- `teamer.js` oder neue `material.js` Route: Material-Endpoints
- `server.js`: Neuer multer-Handler `materialUpload` mit 20MB Limit
- `/uploads/material/` Verzeichnis fuer Datei-Speicherung

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-material*
*Context gathered: 2026-03-12*
