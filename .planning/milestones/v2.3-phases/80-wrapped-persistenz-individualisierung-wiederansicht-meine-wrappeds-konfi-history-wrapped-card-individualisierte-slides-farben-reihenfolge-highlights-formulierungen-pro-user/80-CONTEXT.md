# Phase 80: Wrapped Persistenz + Individualisierung - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A) Wiederansicht: "Meine Wrappeds" im Profil (alle vergangenen Jahre), Teamer Konfi-History Card
B) Individualisierung: Slide-Reihenfolge, Formulierungen, Farb-Akzente, persoenliche Titel
C) Neue Slides: Kategorie-Vorlieben, Gottesdienst-Zaehler, Ueber-das-Ziel goldener Slide

</domain>

<decisions>
## Implementation Decisions

### A) Wiederansicht
- **D-01:** Konfi-Profil + Teamer-Profil: Neue Sektion "Meine Wrappeds" — Liste aller wrapped_snapshots des Users
- **D-02:** Jeder Eintrag: Jahr + Typ (Konfi/Teamer) + Tap oeffnet WrappedModal mit gespeicherten Daten
- **D-03:** Teamer Konfi-History Tab: Card "Dein Konfi-Wrapped [Jahr]" wenn alter Konfi-Snapshot existiert
- **D-04:** GET /api/wrapped/history/:userId — liefert alle Wrapped-Snapshots des Users (Array)

### B) Individualisierung
- **D-05:** Backend berechnet bei Generierung einen "highlight_type" basierend auf staerkstem Bereich:
  - events_held: Meiste Events → "Event-Held:in"
  - badge_collector: Meiste Badges → "Badge-Sammler:in"
  - chat_champion: Meiste Nachrichten → "Chat-Champion"
  - gottesdienst_treue: Meiste Gottesdienste → "Gottesdienst-Treue"
  - gemeinde_aktiv: Meiste Gemeinde-Punkte → "Gemeinde-Aktiv"
  - ueber_das_ziel: Zielwert uebertroffen → "Ueber-Flieger:in" (hoechste Prioritaet!)
- **D-06:** Slide-Reihenfolge: Highlight-Slide kommt als 2. Slide (nach Intro), Rest folgt normal
- **D-07:** Formulierungs-Varianten: 3-4 Texte pro Slide-Typ, Auswahl basierend auf highlight_type oder Zufall (seed aus user_id + year fuer Konsistenz)
- **D-08:** Farb-Akzente: Highlight-Slide bekommt eigene Akzentfarbe (Gold fuer ueber_das_ziel, sonst Bereichsfarbe)

### C) Neue Slides/Inhalte
- **D-09:** Kategorie-Vorlieben-Slide: "Dein Bereich: [Kategorie]!" mit Verteilung als Mini-Diagramm
- **D-10:** Gottesdienst-Zaehler-Slide: "Du hast X Gottesdienste besucht" mit animiertem Count-up
- **D-11:** Ueber-das-Ziel-Slide: GOLDENER Hintergrund (statt Lila), Konfetti-CSS-Animation, grosse Zahl "X Punkte ueber dem Ziel!", ersetzt den Endspurt-Slide wenn Ziel uebertroffen

### Backend-Erweiterung
- **D-12:** wrapped_snapshots JSONB erhaelt zusaetzliche Felder: highlight_type, formulierung_seed, kategorie_verteilung, gottesdienst_count
- **D-13:** Aggregation erweitern: Gottesdienst-Count aus event_bookings WHERE event.point_type='gottesdienst', Kategorie-Verteilung aus konfi_activities GROUP BY category
- **D-14:** Neuer Endpoint: GET /api/wrapped/history/:userId

### Claude's Discretion
- Genauer Konfetti-CSS-Effekt
- Formulierungs-Texte (3-4 pro Slide)
- Mini-Diagramm fuer Kategorie-Verteilung (Balken, Donut, oder einfache Prozentzahlen)
- Farb-Zuordnung pro highlight_type

</decisions>

<canonical_refs>
## Canonical References

- `backend/routes/wrapped.js` — Bestehende Aggregation + Endpoints (Phase 75)
- `frontend/src/components/wrapped/WrappedModal.tsx` — Slide-Container (Phase 76)
- `frontend/src/components/wrapped/slides/` — Alle bestehenden Slides
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` — Profil mit Tabs
- `frontend/src/components/teamer/pages/TeamerKonfiStatsPage.tsx` — Konfi-History
- `frontend/src/components/konfi/pages/KonfiProfilePage.tsx` — Konfi-Profil

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- WrappedModal akzeptiert bereits wrappedType Parameter
- SlideBase + useCountUp + CSS-Animationen stehen
- wrapped_snapshots Tabelle hat JSONB data Feld (flexibel erweiterbar)

### Integration Points
- KonfiProfilePage: Neue "Meine Wrappeds" Sektion
- TeamerProfilePage: Neue "Meine Wrappeds" Sektion
- TeamerKonfiStatsPage: Konfi-Wrapped Card
- wrapped.js: Aggregation erweitern, neuer History-Endpoint

</code_context>

<specifics>
## Specific Ideas

- "Ueber-das-Ziel" ist der emotionalste Moment — goldener Hintergrund, grosse Zahl, Konfetti
- Formulierungen sollen persoenlich klingen, nicht generisch
- seed aus user_id + year damit dasselbe Wrapped immer gleich aussieht (kein Zufall bei Wiederansicht)

</specifics>

<deferred>
None.
</deferred>

---
*Phase: 80-wrapped-persistenz-individualisierung*
