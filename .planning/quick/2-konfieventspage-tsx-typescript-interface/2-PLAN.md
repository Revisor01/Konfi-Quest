---
phase: quick-2
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/konfi/pages/KonfiEventsPage.tsx
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "KonfiEventsPage Event-Interface enthält alle v1.7 Felder die EventsView und EventDetailView erwarten"
    - "TypeScript-Kompilierung schlägt nicht fehl wegen fehlender Felder beim Durchreichen an Child-Components"
  artifacts:
    - path: "frontend/src/components/konfi/pages/KonfiEventsPage.tsx"
      provides: "Event-Interface mit mandatory, bring_items, is_opted_out, point_type, booking_status inkl. opted_out"
      contains: "mandatory"
  key_links:
    - from: "KonfiEventsPage.tsx Event interface"
      to: "EventsView.tsx Event interface"
      via: "events prop durchgereicht"
      pattern: "mandatory.*boolean"
---

<objective>
KonfiEventsPage.tsx Event-Interface um fehlende v1.7 Felder ergänzen, damit die Daten korrekt an EventsView und EventDetailView durchgereicht werden.

Purpose: Die API liefert v1.7-Felder (mandatory, bring_items, is_opted_out, etc.) aber das Event-Interface in KonfiEventsPage.tsx kennt sie nicht, was zu TypeScript-Inkonsistenzen führt.
Output: Aktualisiertes Event-Interface in KonfiEventsPage.tsx
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/konfi/pages/KonfiEventsPage.tsx
@frontend/src/components/konfi/views/EventsView.tsx (Zeilen 40-73: Event-Interface mit mandatory, bring_items, is_opted_out, booking_status inkl. opted_out)
@frontend/src/components/konfi/views/EventDetailView.tsx (Zeilen 55-90: Event-Interface mit point_type, mandatory, bring_items, is_opted_out, has_timeslots, booked_timeslot_*)

<interfaces>
<!-- Aktuelle EventsView.tsx Event-Interface (Ziel-Superset): -->
interface Event {
  id: number;
  name: string;
  description?: string;
  event_date: string;
  event_end_time?: string;
  location?: string;
  location_maps_url?: string;
  points: number;
  categories?: Category[];
  category_names?: string;
  type: string;
  max_participants: number;
  registration_opens_at?: string;
  registration_closes_at?: string;
  registered_count: number;
  registration_status: 'upcoming' | 'open' | 'closed' | 'cancelled';
  created_at: string;
  waitlist_enabled?: boolean;
  max_waitlist_size?: number;
  is_series?: boolean;
  series_id?: number;
  is_registered?: boolean;
  can_register?: boolean;
  attendance_status?: 'present' | 'absent' | null;
  cancelled?: boolean;
  waitlist_count?: number;
  waitlist_position?: number;
  registration_status_detail?: string;
  booking_status?: 'confirmed' | 'waitlist' | 'pending' | 'opted_out' | null;
  is_opted_out?: boolean;
  mandatory?: boolean;
  bring_items?: string;
}

<!-- Zusätzliche Felder aus EventDetailView.tsx: -->
  point_type?: 'gottesdienst' | 'gemeinde';
  has_timeslots?: boolean;
  booked_timeslot_id?: number;
  booked_timeslot_start?: string;
  booked_timeslot_end?: string;
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Event-Interface in KonfiEventsPage.tsx um fehlende v1.7 Felder ergänzen</name>
  <files>frontend/src/components/konfi/pages/KonfiEventsPage.tsx</files>
  <action>
Das Event-Interface in KonfiEventsPage.tsx (Zeilen 25-55) um folgende fehlende Felder ergänzen:

1. `mandatory?: boolean` -- Pflicht-Event Flag (v1.7, Phase 34)
2. `bring_items?: string` -- Mitbring-Items (v1.7, Phase 34)
3. `is_opted_out?: boolean` -- Opt-out Status (v1.7, Phase 35)
4. `point_type?: 'gottesdienst' | 'gemeinde'` -- Punkte-Typ (aus EventDetailView)
5. `has_timeslots?: boolean` -- Timeslot-Flag (aus EventDetailView)
6. `booked_timeslot_id?: number` -- Gebuchter Timeslot (aus EventDetailView)
7. `booked_timeslot_start?: string` -- Timeslot Start (aus EventDetailView)
8. `booked_timeslot_end?: string` -- Timeslot Ende (aus EventDetailView)
9. `booking_status` Union erweitern: `'opted_out'` hinzufügen (aktuell fehlt es, steht aber in EventsView und EventDetailView)

Alle neuen Felder als optional (`?`) hinzufügen da nicht jedes Event alle Felder hat.
Reihenfolge der Felder analog zu EventDetailView.tsx für Konsistenz.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Event-Interface in KonfiEventsPage.tsx enthält alle Felder die EventsView.tsx und EventDetailView.tsx erwarten. booking_status Union enthält 'opted_out'. TypeScript-Kompilierung erfolgreich.</done>
</task>

</tasks>

<verification>
- TypeScript-Kompilierung ohne Fehler: `cd frontend && npx tsc --noEmit`
- Event-Interface in KonfiEventsPage.tsx ist Superset der EventsView.tsx und EventDetailView.tsx Interfaces
</verification>

<success_criteria>
- KonfiEventsPage.tsx Event-Interface enthält mandatory, bring_items, is_opted_out, point_type, has_timeslots, booked_timeslot_*, booking_status mit opted_out
- Keine TypeScript-Fehler
- Kein funktionales Verhalten geändert
</success_criteria>

<output>
Nach Abschluss SUMMARY erstellen (nicht nötig für Quick-Tasks).
</output>
