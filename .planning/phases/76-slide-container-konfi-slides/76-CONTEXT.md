# Phase 76: Slide-Container + Konfi-Slides - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Swiper 12 Setup, Fullscreen-Modal mit dunklem Hintergrund, alle 9 Konfi-Slides mit animierten Inhalten, Progress-Indicator, Schliessen-Button. Keine Share-Funktion (Phase 78).

</domain>

<decisions>
## Implementation Decisions

### Swiper Setup
- **D-01:** Swiper 12 installieren (npm install swiper)
- **D-02:** Swiper React-Komponenten nutzen (Swiper, SwiperSlide)
- **D-03:** EffectCreative fuer Slide-Uebergaenge (Scale + Translate)
- **D-04:** Pagination Module fuer Progress-Dots oben

### Wrapped-Modal
- **D-05:** WrappedModal als eigene Komponente mit useIonModal Pattern
- **D-06:** Fullscreen-Overlay (kein IonPage, kein IonHeader — komplett custom)
- **D-07:** Dunkler Hintergrund (#000), farbige Akzente pro Slide
- **D-08:** X-Button oben rechts zum Schliessen
- **D-09:** Konfi-Farbe: Lila (#5b21b6 → #7c3aed Gradient)

### Slide-Inhalte (Konfi)
- **D-10:** Slide 1 (Intro): Name + Jahrgang, grosser Titel "Dein Konfi-Jahr [Jahr]"
- **D-11:** Slide 2 (Punkte): Gesamtpunkte mit Count-up Animation, Gottesdienst + Gemeinde Aufteilung
- **D-12:** Slide 3 (Events): Anzahl Events + Highlight-Event (meiste Punkte)
- **D-13:** Slide 4 (Badges): Badge-Icons in Grid, verdient/total Zaehler
- **D-14:** Slide 5 (Aktivster Monat): Monatsname + Balkendiagramm (alle Monate)
- **D-15:** Slide 6 (Chat): Nachrichten-Count + Reaktionen-Count
- **D-16:** Slide 7 (Endspurt): NUR wenn unter Zielwert — motivierende Message + fehlende Punkte
- **D-17:** Slide 8 (Abschluss): Zusammenfassung + "Werde Teamer:in!" CTA

### Animationen
- **D-18:** Count-up Animation fuer Zahlen (eigener useCountUp Hook, ~20 Zeilen)
- **D-19:** Fade-in fuer Texte (CSS @keyframes animation mit animation-delay)
- **D-20:** Scale-in fuer Icons/Badges (CSS transform scale 0→1)
- **D-21:** Animationen starten erst wenn der Slide aktiv wird (Swiper onSlideChange)
- **D-22:** KEIN Framer Motion — nur CSS Animations

### Daten-Anbindung
- **D-23:** GET /api/wrapped/:userId bei Modal-Oeffnung
- **D-24:** Loading-Spinner waehrend Daten laden
- **D-25:** Fallback wenn kein Wrapped verfuegbar: "Dein Wrapped wird bald freigeschaltet"

### Claude's Discretion
- Genauer Swiper EffectCreative Config (Scale, Translate Werte)
- Genauer Count-up Timing (Dauer, Easing)
- Slide-Hintergrundfarben (welche Farbe pro Slide)
- Schriftgroessen und Layout-Details

</decisions>

<canonical_refs>
## Canonical References

### Research
- `.planning/research/STACK.md` — Swiper 12 Config, CSS Animations
- `.planning/research/FEATURES.md` — Slide-Reihenfolge, Inhalte
- `.planning/research/ARCHITECTURE.md` — Frontend-Integration

### Backend (Phase 75)
- `backend/routes/wrapped.js` — GET /wrapped/:userId Endpoint (liefert JSONB Snapshot)

### Bestehende Patterns
- `frontend/src/components/shared/FileViewerModal.tsx` — Fullscreen-Modal Referenz (dunkler Hintergrund, X-Button)
- `frontend/src/theme/variables.css` — Bestehende CSS-Variablen und Animationen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- FileViewerModal CSS-Pattern (dunkler Fullscreen, X-Button, safe-area)
- useIonModal Pattern fuer Modal-Praesentation
- getBadgeIcon/getIconFromString Helper fuer Badge-Icons

### Integration Points
- KonfiDashboardPage: "Wrapped ist da!" Card → oeffnet WrappedModal
- GET /api/wrapped/:userId → Daten fuer Slides

</code_context>

<specifics>
## Specific Ideas

- Slide-Design inspiriert von Spotify Wrapped: Grosse Zahlen, zentriert, animiert
- Jeder Slide hat einen eigenen Farb-Akzent (leichte Variation des Lila)
- Count-up soll sich "schnell" anfuehlen (1-2 Sekunden)

</specifics>

<deferred>
## Deferred Ideas

- Teamer-Slides (Phase 77)
- Share-Funktion (Phase 78)
- Dashboard-Card (Phase 79)

</deferred>

---

*Phase: 76-slide-container-konfi-slides*
*Context gathered: 2026-03-22*
