# Events/Material-Vereinheitlichung — Fahrplan (Stand 28.06.2026)

Branch: `refactor/events-unified` (abgezweigt von `feature/ipad-splitview-konfis`).

Ziel: Alle drei Rollen (Konfi/Admin/Teamer) nutzen dieselben gemeinsamen
Bausteine. Was WIRKLICH gemeinsam ist → shared. Was rollenspezifisch ist
(Status-Logik, Aktionen, Tab-Filter) → bleibt getrennt (das ist KEINE Schwäche,
sondern korrekt: jede Rolle sieht ein Event anders).

---

## ✅ ERLEDIGT (alles durchgezogen)

1. **shared/SplitViewShell.tsx** + `useIsWideScreen`-Hook
   - Alle Split-Views nutzen sie (AdminKonfis, Chat, AdminEvents, KonfiEvents,
     TeamerEvents, TeamerMaterial).
2. **shared/eventFormatting.ts** — `formatEventDate/Time/DateLong`
   - In allen Views/DetailViews + Teamer per Alias-Import. `formatEventTime` mit
     Guards (leer/ungültig → ''). Unit-Tests vorhanden.
3. **shared/EventCornerBadges.tsx** — Team/Konfirmation/Pflicht/Status-Badges
   - **In ALLEN drei EventsViews** (Admin/Konfi/Teamer). `hideTeam`-Flag für
     Konfi (kein Team-Badge).
4. **Teamer-Events**: Inline-useIsWide/Cleanup/Split-Layout → shared
   `useIsWideScreen` + `SplitViewShell`.
5. **Teamer-Material**: gleiches Muster angewendet (renderDetail/renderList +
   SplitViewShell + useIsWideScreen + hideBackButton). Split-View eingeführt.
   - Admin-Material bleibt bewusst Modal-basiert (CRUD), wie Anträge.

---

## BEWUSST NICHT VEREINHEITLICHT (rollenspezifisch korrekt)

- **Status-Logik** (`getStatusColors`/`getStatusText`): fundamental verschieden
  pro Rolle (Konfi: Pflicht/Opt-Out/Anwesenheit/Warteliste-Position/
  Konfirmation-Sperre, ~22 Zweige; Teamer: Dabei/"Nur Info"/Team, ~9 Zweige;
  Admin: Verbuchen-Status). Verschiedene event-Felder. Eine unified-Funktion
  wäre ein if(role)-Monster — schlechter als 3 klare Funktionen. LASSEN.
- **Aktionen**: Konfi register/opt-out, Teamer book/unbook, Admin CRUD+Serien+
  Teilnehmer-Verwaltung. LASSEN.
- **Tab-Filter**: Konfi (meine/alle/konfirmation), Admin (aktuell/verbuchen/
  vergangen), Teamer (alle/meine/team) — verschiedene Semantik. LASSEN.

---

## OPTIONAL (nur Kosmetik, nicht funktional noetig)

- **Teamer-Event-Detail in eigene View ziehen**: Teamer-Events nutzt weiterhin
  ein In-Page `renderDetail()` (State `selectedEvent`), waehrend Konfi/Admin
  eine separate `EventDetailView` (eventId+onBack) + Route haben. Funktioniert
  identisch (Split-View laeuft), ist aber strukturell uneinheitlich. Wer es ganz
  sauber will: `renderDetail` nach `teamer/views/TeamerEventDetailView.tsx`
  extrahieren. KEIN Verhalten aendert sich — reine Struktur. Niedrige Prioritaet.

---

## SONSTIGES / HYGIENE

- `.gitignore`: `build_ios/`, `frontend/ios/App/build_archive/`,
  `frontend/ios/App/build_export/` und die `*.png`-Screenshots im Repo-Root
  gehören ignoriert (liegen aktuell untracked rum).
- Anträge-iPad: bleibt volle Breite + Modal (kein Split). Optional später:
  zentrierte max-width-Spalte für Modal-Listen (Badges/Material/Anträge/CRUD).
- Branch-Stand vor Merge: Split-View-Branch (Konfis/Chat/Events) + dieser
  Refactor-Branch sollten am echten iPad getestet werden, bevor → main.
