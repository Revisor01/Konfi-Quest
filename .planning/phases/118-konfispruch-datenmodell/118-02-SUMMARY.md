---
phase: 118-konfispruch-datenmodell
plan: 02
subsystem: frontend
tags: [konfispruch, dashboard, modal, ionic, konfi]
status: human-verify-pending
requires:
  - 118-01 (Backend-Vertrag GET /konfsprueche, GET /profile.konfspruch, PATCH /profile)
  - DashboardView Sektion-Renderer-Muster (konfirmation als Vorlage)
  - KonfiDashboardPage useIonModal-Muster (PointsHistoryModal)
provides:
  - KonfispruchSelectModal (useIonModal, Listen-Auswahl mit 4 Uebersetzungs-Tabs + Freitext)
  - Dashboard-Sektion 'konfispruch' (Card 'Dein Konfispruch')
  - CSS-Klasse .app-dashboard-section--konfispruch (Indigo/Violett-Gradient)
  - useIonModal-Wiring + Profil-Query fuer gewaehlten Spruch in KonfiDashboardPage
affects:
  - Phase 119 (pro-Jahrgang-Gate fuer die Card + Admin-Einsicht baut hierauf auf)
tech-stack:
  added: []
  patterns:
    - useIonModal-Hook (NIE IonModal isOpen)
    - Doppelte IonSegment (Modus-Umschaltung + Uebersetzungs-Tabs nur im Listen-Modus)
    - Gewaehlter Spruch via separater GET /profile-Query in die Dashboard-Daten gemergt
key-files:
  created:
    - frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx
  modified:
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
    - frontend/src/theme/variables.css
decisions:
  - "Der gewaehlte Spruch kommt NICHT aus /konfi/dashboard, sondern aus einer separaten GET /konfi/profile-Query (useOfflineQuery, CACHE_TTL.PROFILE) und wird in der Page in dashboardData gemergt"
  - "CSS-Gradient Indigo/Violett (#6d28d9 -> #4338ca), klar unterscheidbar von --konfirmation (#1e3a8a)"
  - "Card ohne show_*-Gate und ohne pro-Jahrgang-Gate in Phase 118 (immer sichtbar); Gate folgt Phase 119"
metrics:
  duration: ca. 20 Min
  completed: 2026-06-09
  tasks: 2 (von 3 — Task 3 ist human-verify, PENDING)
  files: 4
---

# Phase 118 Plan 02: Konfispruch-Auswahl Frontend Summary

Frontend fuer die Konfispruch-Auswahl: ein neues `KonfispruchSelectModal` (useIonModal) mit Listen-Auswahl inklusive 4 umschaltbarer Uebersetzungs-Tabs sowie einem Freitext-Modus mit Pflicht-Stellenangabe, eine neue klickbare Dashboard-Card "Dein Konfispruch" (eigene CSS-Klasse, Indigo/Violett-Gradient) und das Modal-Wiring in der KonfiDashboardPage. Speichern persistiert via `PATCH /api/konfi/profile`; nach dem Speichern aktualisiert ein Refresh von Profil + Dashboard die Card.

## Was gebaut wurde

### Task 1 — KonfispruchSelectModal (commit 03deec4)
`frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx` (neu):
- Props: `{ onClose, onSuccess, current? }`. Grundgeruest wie PointsHistoryModal (IonPage > IonHeader/IonToolbar mit Titel "Dein Konfispruch", Schliessen-Button `app-modal-close-btn`, Speichern-Button `app-modal-submit-btn--konfi` mit Offline-Zustand).
- Obere IonSegment-Umschaltung "Aus Liste" / "Eigener Spruch" (State `mode`).
- Listen-Modus: GET `/konfi/konfsprueche` beim Mount (IonSpinner waehrend Laden). Zweite IonSegment-Tableiste fuer die 4 Uebersetzungen `luther2017` | `bigs` | `gute_nachricht` | `elberfelder` (Labels "Luther 2017" / "Bibel in gerechter Sprache" / "Gute Nachricht" / "Elberfelder"), nur in diesem Modus gerendert, `scrollable`. Pro Spruch: Referenz + Text der gewaehlten Uebersetzung; leerer Text zeigt Platzhalter "Text wird noch ergaenzt". Auswahl per Klick (checkmarkCircle-Indikator).
- Freitext-Modus: KEINE Uebersetzungs-Tabs. IonTextarea (Spruchtext) + IonInput (Stelle, z.B. "Joh 3,16"). Clientseitige Pflicht-Validierung: leerer Text -> Toast "Bitte gib deinen Spruchtext ein"; leere Referenz -> Toast "Bitte gib die Stellenangabe an" (kein Submit).
- Speichern: Listen-Modus `api.patch('/konfi/profile', { konfspruch_id, translation })`, Freitext-Modus `api.patch('/konfi/profile', { konfspruch_freitext, konfspruch_freitext_referenz })`. API-Fehler werden als deutscher Toast angezeigt. Bei Erfolg `onSuccess()`.
- Vorbelegung: bei vorhandenem `current` werden Modus + Felder vorbefuellt.

### Task 2 — Dashboard-Card + CSS + Wiring (commit 38c16d7)
`frontend/src/components/konfi/views/DashboardView.tsx`:
- `DashboardData` um optionales Feld `konfspruch` erweitert.
- `DEFAULT_KONFI_ORDER` = `['konfirmation', 'konfispruch', 'events', 'losung', 'badges', 'ranking']`.
- Prop `onOpenKonfispruch?: () => void` (Interface + Destructuring).
- Neuer sectionRenderer `konfispruch` (analog konfirmation): `app-dashboard-section app-dashboard-section--konfispruch` + `__bg-label` "DEIN"/"KONFISPRUCH" + `__content`. Liegt ein Spruch vor, wird er als Zitat (`app-dashboard-quote` + `app-dashboard-cite`) gezeigt, sonst die Aufforderung "Tippe, um deinen Konfirmationsspruch zu waehlen". Ganze Card per `onClick={onOpenKonfispruch}` klickbar (cursor: pointer). Kein show_*- und kein Jahrgang-Gate (immer sichtbar).

`frontend/src/theme/variables.css`:
- Neue Klasse `.app-dashboard-section--konfispruch` im Modifier-Block: `linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)` + passender box-shadow — klar unterscheidbar von `--konfirmation` (#1e3a8a, Blau).

`frontend/src/components/konfi/pages/KonfiDashboardPage.tsx`:
- Import `KonfispruchSelectModal`.
- Neue `useOfflineQuery` `konfi:profile:<userId>` -> GET `/konfi/profile` (CACHE_TTL.PROFILE) liefert das Feld `konfspruch`.
- `useIonModal(KonfispruchSelectModal, { onClose, onSuccess: () => { dismiss(); refreshProfile(); refreshDashboard(); }, current: konfiProfile?.konfspruch ?? null })`.
- `openKonfispruch` -> `presentKonfispruchModal({ presentingElement: pageRef.current || undefined })`.
- `sectionOrder`-Fallback enthaelt jetzt 'konfispruch'.
- `dashboardDataWithKonfspruch` mergt den Spruch aus der Profil-Query in die Dashboard-Daten; `onOpenKonfispruch={openKonfispruch}` an DashboardView uebergeben.

## API-Anbindung (gemaess 118-01-SUMMARY.md)

- GET `/api/konfi/konfsprueche` -> Array `{ id, reference, book, chapter, verse, uebersetzungen: { luther2017, bigs, gute_nachricht, elberfelder } }`. Leere Texte -> Platzhalter im Modal.
- GET `/api/konfi/profile` -> Feld `konfspruch`: `{ source:'liste', id, reference, text, translation }` | `{ source:'freitext', text, reference }` | `null`.
- PATCH `/api/konfi/profile`: Listen-Wahl `{ konfspruch_id, translation }`, Freitext `{ konfspruch_freitext, konfspruch_freitext_referenz }`.

## Offener Punkt fuer Phase 119

- Pro-Jahrgang-Gate fuer die Sichtbarkeit der Card (`jahrgaenge`-Flag) + Admin-Einsicht in die hinterlegten Sprueche. In Phase 118 ist die Card bewusst immer sichtbar.

## Deviations from Plan

Keine inhaltlichen Abweichungen vom Plan. Umsetzungs-Detail:

**1. [Detail] Gewaehlter Spruch via separater Profil-Query**
- Das Plan-`<interfaces>` erlaubte explizit, den Spruch ueber GET /profile nachzuladen, falls `dashboardData` ihn nicht traegt. Der `/konfi/dashboard`-Endpoint liefert `konfspruch` NICHT, daher eine eigene `useOfflineQuery` auf `/konfi/profile` und Merge in die Dashboard-Daten. `onSuccess` refresht beide Queries, sodass die Card direkt aktuell ist.

## Verifikation

- `npx tsc --noEmit -p tsconfig.json` -> keine Fehler in KonfispruchSelectModal.tsx, DashboardView.tsx, KonfiDashboardPage.tsx.
- `npm run build` (mit verlinktem node_modules aus dem Haupt-Checkout, da der Worktree keine Dependencies installiert hat) -> erfolgreich (`built in 511ms`, exit 0). Warnungen (Chunk-Groesse, dynamischer Import) sind vorbestehend und unabhaengig.
- grep-Acceptance gruen: `konfispruch` in DashboardView (Renderer + Klasse), `app-dashboard-section--konfispruch` in variables.css, `KonfispruchSelectModal` + `onOpenKonfispruch` in KonfiDashboardPage.

## Human-Verify: PENDING (Task 3, checkpoint:human-verify, gate=blocking)

Task 3 ist ein blockierender Human-Verify-Checkpoint und wurde NICHT als bestanden markiert.

Vorbereitung soweit non-interaktiv moeglich:
- `cd frontend && npm run build` -> erfolgreich (siehe oben).
- `npx cap sync ios` wurde NICHT ausgefuehrt: der Worktree hat keine installierten Dependencies und cap-sync/CocoaPods/Xcode-Tooling ist hier nicht non-interaktiv verfuegbar. Der iOS-Build erfolgt durch den Menschen in Xcode (Projektregel: nach Frontend-Aenderungen Xcode-Build).

Manuelle Verifikation (im iOS-Simulator als Konfi, z.B. simon123):
1. Dashboard: Card "Dein Konfispruch" sichtbar, eigene Farbe (Indigo/Violett, unterscheidbar von Konfirmation-Card), keine Emojis, echte Umlaute.
2. Card antippen -> Auswahl-Modal oeffnet als Sheet (presentingElement).
3. Modus "Aus Liste": Spruchliste + obere Uebersetzungs-Tableiste (4 Tabs) umschaltbar; ohne hinterlegte Texte zeigt jeder Eintrag den Platzhalter (kein erfundener Bibeltext). Spruch waehlen + speichern -> Modal schliesst, Card zeigt den Spruch.
4. Modus "Eigener Spruch": KEINE Uebersetzungs-Tabs. Speichern OHNE Stellenangabe -> deutscher Hinweis, kein Speichern. Mit Stellenangabe -> Card zeigt Freitext + Referenz.
5. Pruefen: keine Emojis, korrekte Umlaute, deutsche Texte ueberall.

## Self-Check: PASSED

Alle erstellten/geaenderten Dateien vorhanden, beide Task-Commits (03deec4, 38c16d7) im Log. Plan ist NICHT vollstaendig abgeschlossen — Task 3 (human-verify) steht aus.
