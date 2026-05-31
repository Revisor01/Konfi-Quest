---
phase: 115-konfi-limits-pro-org-tarif-durchsetzung
plan: 03
subsystem: frontend / konfi-limit-anbindung (super_admin-Feld, Anzeige, Grace-Dialog)
tags: [konfi-limit, tarif, grace, super_admin, rbac, frontend, ionic]
requires:
  - "PATCH /organizations/:id/limit (super_admin-only, Plan 01)"
  - "GET /organizations/:id liefert max_konfis (Plan 01)"
  - "409/403-Response-Vertrag aus Plan 02 (error_code limit_grace/limit_exceeded, count/limit/next_tier, confirm-Flag)"
provides:
  - "max_konfis-Eingabefeld in der Org-Verwaltung (nur super_admin)"
  - "read-only X von Y Konfis in der Konfi-Liste (org_admin/admin)"
  - "Grace-Bestätigungsdialog (Trotzdem anlegen + confirm:true-Retry) bei 409"
  - "Hard-Block-Hinweis ohne Override bei 403"
affects:
  - "Abschluss der Tarif-Durchsetzung sichtbar/bedienbar im UI (Phase 115)"
tech-stack:
  added: []
  patterns:
    - "Separater String-State für max_konfis (getrennt vom isDirty-formData, da eigener PATCH-Endpunkt)"
    - "error_code-Verzweigung im catch unterscheidet Grace-409 / Hard-403 / Username-409"
    - "Erfolgslogik in handleKonfiCreated ausgelagert, vom confirm-Retry wiederverwendet"
key-files:
  created: []
  modified:
    - "frontend/src/components/admin/modals/OrganizationManagementModal.tsx"
    - "frontend/src/components/admin/KonfisView.tsx"
    - "frontend/src/components/admin/pages/AdminKonfisPage.tsx"
decisions:
  - "max_konfis-Feld nur im Edit-Modus + nur super_admin (PATCH /:id/limit braucht bestehende Org)"
  - "Limit als separater State (nicht in formData) — verhindert isDirty-Verwerfen-Dialog für den eigenen PATCH-Speicher-Button"
  - "KonfisView lädt max_konfis selbst via GET /organizations/:id (eigene Org), kein neuer Endpunkt, keine Prop-Kette über AdminKonfisPage"
  - "KonfiModal NICHT verändert — gesamte Limit-Logik liegt in AdminKonfisPage, Modal reicht konfiData unverändert weiter"
metrics:
  duration: "~10 min"
  completed: "2026-05-31"
  tasks: 2
  files: 3
---

# Phase 115 Plan 03: Frontend-Anbindung der Konfi-Limit-Durchsetzung Summary

Frontend-Abschluss der Tarif-Durchsetzung: super_admin setzt das Konfi-Limit pro Organisation,
die Org-Leitung sieht den Stand read-only als "X von Y Konfis", und beim Anlegen erscheint bei
Erreichen der Grace-Zone ein "Trotzdem anlegen"-Dialog mit Tarif-Hinweis bzw. bei Limit+5 ein
Hard-Block-Hinweis ohne Override. Der Server bleibt Single Source of Truth (Wave 2) — das UI führt
nur durch den 409/403-Response-Vertrag.

## Was gebaut wurde

### Task 1: max_konfis-Feld (super_admin) + read-only "X von Y" (Commit c417531)
**OrganizationManagementModal.tsx:**
- `isSuperAdmin = user?.role_name === 'super_admin'` (etabliertes Muster aus AdminSettingsPage).
- Neue Sektion "Konfi-Limit (Tarif)" nur im Edit-Modus UND nur für super_admin sichtbar
  (org_admin sieht sie nicht).
- Numerisches `IonInput type="number"` (separater String-State `maxKonfis`, NICHT in formData,
  damit der isDirty-Verwerfen-Dialog nicht für den eigenen Speicher-Button greift).
- Wert wird beim Öffnen aus `GET /organizations/:id` (`max_konfis`) geladen; leeres Feld = NULL.
- `handleSaveLimit` validiert (null oder Integer >= 0) und speichert via
  `api.patch('/organizations/:id/limit', { max_konfis: <int|null> })`. Leeres Feld sendet `null`.
- Hinweis-Box erklärt die 5er-Grace-Zone.

**KonfisView.tsx:**
- Lädt `max_konfis` der eigenen Organisation via `GET /organizations/${user.organization_id}`
  (kein neuer Endpunkt, `useApp()` für organization_id).
- Read-only Anzeige zwischen SectionHeader und Segment (nur im Konfi-Modus):
  `X von Y Konfis` bei gesetztem Limit, `X Konfis` bei NULL/unbegrenzt. `X` = `konfis.length`.

### Task 2: Grace-Dialog + Hard-Block-Hinweis (Commit 05d2999)
**AdminKonfisPage.tsx — handleAddKonfi umgebaut:**
- Erfolgslogik (Jahrgangschat, Einmalpasswort-Alert, refreshKonfis) in `handleKonfiCreated`
  ausgelagert, damit der Grace-Retry sie wiederverwenden kann.
- catch verzweigt nach `err.response.data.error_code`:
  - `'limit_grace'` (409) -> `presentGraceDialog`: zeigt "X von Y Konfis" (count/limit), den
    Tarif-Hinweis ("Der nächste Tarif gibt dir Platz für bis zu {next_tier} Konfis." bzw. Hinweis
    bei `next_tier === null`) und zwei Buttons: "Abbrechen" + "Trotzdem anlegen". "Trotzdem anlegen"
    sendet `POST /admin/konfis` erneut mit `{ ...konfiData, confirm: true }` und behandelt die
    201-Antwort über `handleKonfiCreated` (Einmalpasswort-Alert, refreshKonfis).
  - `'limit_exceeded'` (403) -> reiner Hinweis-Alert "Tarif-Upgrade nötig" mit next_tier-Verweis,
    nur Button "Verstanden" — KEINE "Trotzdem anlegen"-Option.
  - Status 409 ohne `error_code` (Username-Kollision) -> unveränderte Namens-Fehlermeldung.
  - sonst -> generische Fehlermeldung wie zuvor.
- KonfiModal nicht verändert (reicht konfiData unverändert weiter).

## Schnittstellen-Konsum (aus Plan 01/02)

- `PATCH /organizations/:id/limit` `{ max_konfis: number|null }` (super_admin-only).
- `GET /organizations/:id` -> Feld `max_konfis` (number|null) für die Anzeige.
- 409 `{ error_code: 'limit_grace', count, limit, next_tier }` -> Grace-Dialog, Retry mit `confirm: true`.
- 403 `{ error_code: 'limit_exceeded', count, limit, next_tier }` -> Hard-Block-Hinweis.
- `next_tier === null` (Limit >= 100) -> Fallback-Text ohne konkrete Stufe.

## Verifikation

- `cd frontend && npx tsc --noEmit -p tsconfig.json` -> EXIT 0 (nach beiden Tasks).
- `grep -c max_konfis OrganizationManagementModal.tsx` = 3; `grep -c super_admin` = 3.
- `grep -c limit_grace AdminKonfisPage.tsx` = 1; `grep -c limit_exceeded` = 1; `confirm: true` vorhanden.
- Emoji-Scan über alle 3 Dateien: keine Unicode-Emojis. Echte Umlaute durchgehend (keine ue/oe/ae-Ersatzschreibweise in neuen Strings/Kommentaren).

## Deviations from Plan

**[Rule 3 - Scope-Klärung] KonfiModal.tsx nicht verändert.** Der Plan listet KonfiModal.tsx unter
den Files von Task 2, aber die gesamte Grace-/Hard-Block-Logik gehört in den Aufrufer
(AdminKonfisPage.handleAddKonfi), der die Server-Antwort sieht. KonfiModal reicht `konfiData`
unverändert über `onSave` weiter und braucht keine Änderung. Kein funktionaler Abstrich — die
Plan-Anforderungen sind vollständig in AdminKonfisPage umgesetzt.

Sonst: Plan exakt wie geschrieben umgesetzt.

## Checkpoint (Task 3: human-verify) — AUSSTEHEND, vom User zu verifizieren

Der Plan endet mit einem `checkpoint:human-verify`. Die beiden Code-Tasks sind vollständig
umgesetzt und committet; die visuelle/funktionale Prüfung steht aus und ist vom User/Orchestrator
durchzuführen:

1. Als **super_admin** eine Org bearbeiten: Sektion "Konfi-Limit (Tarif)" erscheint, `max_konfis`
   z.B. auf die aktuelle Konfi-Zahl setzen, "Konfi-Limit speichern" -> Erfolgsmeldung.
2. Als **org_admin** prüfen: das max_konfis-Feld erscheint NICHT, aber in der Konfi-Liste steht
   read-only "X von Y Konfis" (bzw. "X Konfis", falls Limit NULL).
3. Konfi anlegen, während `count == limit`: Grace-Dialog erscheint, nennt "X von Y Konfis" und den
   nächsten Tarif, "Trotzdem anlegen" legt den Konfi an (Einmalpasswort-Alert folgt).
4. max_konfis so setzen, dass `count >= limit + 5`: Anlegen wird mit Hinweis "Tarif-Upgrade nötig"
   abgewiesen, KEINE "Trotzdem anlegen"-Option.
5. Texte prüfen: echte Umlaute, keine Emojis. (Statisch bereits verifiziert.)

Resume-Signal laut Plan: "approved" oder Abweichungen beschreiben.

## Self-Check: PASSED

- FOUND: frontend/src/components/admin/modals/OrganizationManagementModal.tsx
- FOUND: frontend/src/components/admin/KonfisView.tsx
- FOUND: frontend/src/components/admin/pages/AdminKonfisPage.tsx
- FOUND commit: c417531 (Task 1)
- FOUND commit: 05d2999 (Task 2)
