---
phase: 116-badge-system-audit-pflicht-anwesenheits-badges-anzahl-teamer
plan: 03
subsystem: frontend-admin-badges
tags: [badges, modal, mandatory_event_count, target_role]
requires:
  - "Backend GET /admin/badges/criteria-types liefert mandatory_event_count (Plan 01)"
provides:
  - "Freischaltung mandatory_event_count im Badge-Erstellungs-Modal (Konfi-only)"
  - "Wert-Label 'Anzahl (Pflicht-Events)' + Default-Farbe #b91c1c"
affects:
  - "frontend/src/components/admin/modals/BadgeManagementModal.tsx"
tech-stack:
  added: []
  patterns:
    - "TEAMER_HIDDEN_TYPES-Filter fuer Konfi-only Sichtbarkeit"
    - "CATEGORY_COLORS Default-Farbe pro criteria_type"
key-files:
  created: []
  modified:
    - "frontend/src/components/admin/modals/BadgeManagementModal.tsx"
decisions:
  - "Default-Farbe #b91c1c (dunkleres Rot, klar von event_count #e63946 unterscheidbar)"
  - "Konfi-only via TEAMER_HIDDEN_TYPES (analog event_count, D-03)"
metrics:
  duration: "~3 min"
  completed: "2026-05-31"
---

# Phase 116 Plan 03: Frontend Modal (mandatory_event_count) Summary

Freischaltung des neuen Pflicht-Anwesenheits-Badge-Typs `mandatory_event_count` im Badge-Erstellungs-Modal: Konfi-only sichtbar, mit Wert-Label "Anzahl (Pflicht-Events)" und eigener Default-Farbe.

## Was umgesetzt wurde

Der Typ `mandatory_event_count` kommt bereits ueber GET /admin/badges/criteria-types vom Backend (Plan 01). Im Modal wurden drei zentrale Stellen ergaenzt:

1. **Default-Farbe** (CATEGORY_COLORS): `mandatory_event_count: '#b91c1c'` — ein dunkleres Rot, klar unterscheidbar von `event_count: '#e63946'`.
2. **getValueLabel**: neuer `case 'mandatory_event_count':` mit Rueckgabe `'Anzahl (Pflicht-Events)'`.
3. **Sichtbarkeit (D-03, Konfi-only)**: `'mandatory_event_count'` zu `TEAMER_HIDDEN_TYPES` hinzugefuegt — bei target_role=teamer ausgeblendet, bei Konfi sichtbar (analog zu `event_count`).

Modal-Struktur, IonModal-Verwendung und der generische Typ-Auswahl-Filter blieben unangetastet.

## Verifikation

- `npx tsc --noEmit -p tsconfig.json` -> keine Fehler in BadgeManagementModal.tsx
- grep-Verify-Block: >= 3 Treffer fuer `mandatory_event_count`, in `TEAMER_HIDDEN_TYPES` vorhanden, Label `Anzahl (Pflicht-Events)` gesetzt -> "VERHALTEN OK"

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- 8b1f370: feat(116-03): mandatory_event_count im Badge-Modal freischalten

## Self-Check: PASSED
