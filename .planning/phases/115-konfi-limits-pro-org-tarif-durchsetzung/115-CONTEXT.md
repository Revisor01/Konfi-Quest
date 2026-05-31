# Phase 115: Konfi-Limits pro Org (Tarif-Durchsetzung) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** Discuss (Entscheidungen mit Inhaber abgestimmt)

<domain>
## Phase Boundary

Pro Organisation ein Konfi-Limit (`max_konfis`) durchsetzen, damit die Preistabelle technisch
wirksam wird. Nur `super_admin` setzt das Limit pro Org (passend zum gekauften Tarif); Org-Admins
sehen es read-only. Gezaehlt werden ausschliesslich Konfis (Rolle `konfi`) — Teamer:innen + Admins
unbegrenzt. Beim Konfi-Anlegen greift eine 3-Stufen-Grace-Logik. Echte Multi-Tenancy bleibt
(eine DB, `organization_id`) — KEINE neue DB pro Kunde.

NICHT in dieser Phase: Kirchenkreis-Hierarchie (parent_organization_id), Self-Service-Org-Erstellung,
Limit-Absicherung von Bulk-/CSV-/Invite-Anlage-Wegen (eigene Phase falls noetig), Teamer-/Admin-Limits.
</domain>

<decisions>
## Implementation Decisions

### Schema + Default (SCH)
- **D-01:** Neue Spalte `organizations.max_konfis INTEGER NULL`. NULL = unbegrenzt (Durchsetzung
  uebersprungen). Migration backfillt KEINE Werte — bestehende UND neue Orgs starten auf NULL.
  Der super_admin setzt Limits manuell pro Tarif. Sicherste Migration, bricht keine aktive Gemeinde.
- **D-02:** Migration ist die naechste freie Nummer nach 082 (siehe Phase 114) — Planner ermittelt
  die exakte Nummer (alphabetisch sortierter Runner, backend/database.js).

### Wer setzt das Limit (AUTH)
- **D-03:** NUR `super_admin` darf `max_konfis` setzen. KRITISCH: Die bestehende Org-PUT-Route
  (`organizations.js:291`) erlaubt auch `org_admin` das Bearbeiten der EIGENEN Org (`isOwnOrg`-Check,
  Zeile 301). `max_konfis` darf daher NICHT in diese PUT-Route aufgenommen werden, sonst koennte
  ein org_admin sein eigenes Limit hochsetzen und den Tarif aushebeln.
- **D-04:** `max_konfis` wird ueber einen EIGENEN super_admin-only Endpunkt gesetzt
  (z.B. `PATCH /api/organizations/:id/limit`, geschuetzt mit `requireSuperAdmin`). Die normale
  Org-PUT-Route ignoriert/verwirft das Feld komplett. Beim Org-Anlegen (`organizations.js:165`,
  bereits `requireSuperAdmin`) kann `max_konfis` optional mitgegeben werden (Claude's Discretion,
  ob im Create-Body oder nur via PATCH nachtraeglich).

### Grace-Verhalten beim Konfi-Anlegen (GRACE)
- **D-05:** 3-Stufen-Logik in der POST-Konfi-Route (`konfi-management.js:134`), basierend auf
  `COUNT(konfis der Org)` vs `max_konfis`:
  1. **Unter Limit** (count < max_konfis): normal anlegen, 201.
  2. **Grace-Bereich** (max_konfis <= count < max_konfis + 5): Server antwortet mit **409**
     + Hinweis ("Tarif ausgeschoepft, X von Y Konfis"). Frontend zeigt einen Bestaetigungsdialog,
     der dem Nutzer (a) erklaert, dass eine Grace-Periode eingeraeumt wird, (b) ihn ZUM BESTAETIGEN
     zwingt, dass er bewusst ueber das Limit geht ("Trotzdem anlegen"), und (c) BEREITS HIER aktiv
     auf den naechsthoeheren Tarif hinweist (z.B. "Der naechste Tarif gibt dir bis zu Z Konfis").
     Erneuter Request mit `confirm: true` (oder aequivalentem Flag) im Body legt den Konfi an.
     Server ist Single Source of Truth.
  3. **Harte Grenze** (count >= max_konfis + 5): **403**, Anlegen verweigert. Klare Aufforderung
     "Tarif-Upgrade noetig" mit Verweis auf den passenden naechsten Tarif. Kein Override moeglich.
- **D-06:** Bei `max_konfis IS NULL`: Check komplett uebersprungen (unbegrenzt), immer 201.
- **D-07:** Zaehlung: nur Rolle `konfi` der jeweiligen Org. Soft-geloeschte Konfis (Phase 114,
  `users.deleted_at IS NOT NULL`) zaehlen NICHT mit — `WHERE deleted_at IS NULL` im COUNT.

### Anlage-Wege (WAYS)
- **D-08:** In dieser Phase wird NUR das Einzel-Anlegen (POST-Konfi-Route) mit dem Limit-Check
  abgesichert. Researcher prueft, ob weitere Wege existieren, ueber die Konfis entstehen
  (Bulk-Anlage, CSV-Import, Invite-Code-Registrierung — Invite-Codes existieren laut Migration 079).
  Falls vorhanden: als Deferred dokumentieren, NICHT in dieser Phase absichern (bewusste Scope-Grenze).

### Limit-Anzeige (UI)
- **D-09:** Org-Leitung sieht ihren aktuellen Stand read-only ("X von Y Konfis") — z.B. in der
  Konfi-Liste/Verwaltung oder im Admin-Dashboard (Claude's Discretion, wo am sinnvollsten).
  Bei `max_konfis IS NULL`: Anzeige "X Konfis" ohne Limit oder ganz ausblenden.
- **D-10:** super_admin sieht/setzt `max_konfis` in der Org-Verwaltungs-UI (Org-Anlegen/-Bearbeiten).

### Claude's Discretion
- Exakte Migration-Nummer (naechste nach 082).
- Genauer Endpunkt-Pfad/Methode fuer das super_admin-Limit-Setzen (PATCH /:id/limit vs eigener Route).
- Wo `max_konfis` im Create-Org-Flow ankommt (Body vs nur nachtraeglich via PATCH).
- Genaue Platzierung der read-only "X von Y"-Anzeige (Liste vs Dashboard).
- Exaktes Feld fuer das Confirm-Flag im Grace-Request.
- Ob ein leichter GET-Endpunkt fuer "aktueller Stand" (count + limit) noetig ist oder die Daten
  aus bestehenden Queries kommen.
- Woher der "naechsthoehere Tarif"-Hinweis (D-05.2/3) seine Werte nimmt: harte Tarif-Stufen-Liste
  (15/50/75/100) im Code/Config vs. nur generischer Hinweis ohne konkrete Zahl. Da es (noch) keine
  `plan`/`tier`-Spalte gibt, reicht zunaechst eine einfache Stufen-Konstante; Planner entscheidet,
  ob Backend (im 409-Response mitgeliefert) oder Frontend (statische Liste) den naechsten Tarif nennt.
</decisions>

<canonical_refs>
## Canonical References

- `backend/init-scripts/01-create-schema.sql:12-17` — organizations-Tabelle (aktuell 4 Spalten,
  via Migrationen erweitert um slug/display_name/contact_* etc.; KEIN Limit-Feld)
- `backend/routes/organizations.js:165` — POST Org anlegen (requireSuperAdmin, validateCreateOrg)
- `backend/routes/organizations.js:291-305` — PUT Org bearbeiten (erlaubt org_admin fuer eigene Org
  via isOwnOrg-Check — DARF max_konfis NICHT enthalten)
- `backend/routes/konfi-management.js:134` — POST Konfi anlegen (requireAdmin, validateCreateKonfi)
  — hier kommt der 3-Stufen-Limit-Check hin
- `backend/database.js` — Migration-Runner (alphabetisch sortiert, letzte ist 082 aus Phase 114)
- `backend/migrations/079_add_invite_codes.sql` — Invite-Codes existieren (moeglicher zusaetzlicher
  Anlage-Weg, Researcher prueft)
- Memory `konfi_limits_konzept.md` — code-verifiziertes Konzept (Multi-Tenancy-Stand, Limit-Logik)
- Preistabelle-Werte (Memory `session_30mai_launch`): 15/50/75/100 Konfis pro Tarif

</canonical_refs>

<code_context>
## Existing Code Insights

- `organizations`-Tabelle hat KEINE Limit-/Plan-/Tier-Felder — neue Spalte noetig.
- Echte Multi-Tenancy verifiziert: alle relevanten Tabellen `organization_id NOT NULL`, Routes
  filtern konsequent nach `req.user.organization_id`. Kein Datenleck. KEINE neue DB pro Kunde.
- Org-Anlegen nur `super_admin` (organizations.js:165), Org-PUT auch org_admin fuer eigene Org
  (organizations.js:301 isOwnOrg) — DESHALB Limit-Setzen in eigenen super_admin-Endpunkt.
- POST-Konfi-Route ist `requireAdmin` (org_admin/admin) — der Limit-Check sitzt also serverseitig
  vor dem INSERT, unabhaengig von der Rolle des Anlegenden.
- Phase 114 fuehrte `users.deleted_at` ein — der Konfi-COUNT muss `deleted_at IS NULL` filtern,
  sonst zaehlen archivierte Konfis faelschlich gegen das Limit.
- vitest-Test-Infrastruktur vorhanden (tests/helpers: getTestPool, truncateAll, seed;
  `npx vitest run --config tests/vitest.config.ts`). Tests mitschreiben (Projekt-Feedback).

</code_context>

<specifics>
## Specific Ideas

- Grace-Puffer ist bewusst +5 (Kulanz), damit eine Gemeinde kurz vor Tarif-Grenze nicht
  hart blockiert wird, aber zur bewussten Entscheidung gezwungen ist ("Trotzdem anlegen").
- Hinweis-Texte deutsch, echte Umlaute, keine Emojis (CLAUDE.md). Beispiel:
  "Tarif ausgeschoepft (15 von 15 Konfis). Du kannst bis zu 5 weitere anlegen — danach ist
  ein Upgrade noetig."
- Test-Tarif-Limit (5 Konfis) muss NICHT hart durchgesetzt werden — Fokus liegt auf den
  Bezahl-Tarif-Limits.

</specifics>

<deferred>
## Deferred Ideas

- Limit-Absicherung von Bulk-/CSV-Import + Invite-Code-Registrierung (falls solche Wege existieren)
  — eigene Phase, sobald die Wege identifiziert sind (D-08).
- Teamer-/Admin-Limits pro Tarif (aktuell unbegrenzt) — falls spaeter ein Tarif das braucht.
- `plan`/`tier`-Spalte auf organizations (statt nur max_konfis) fuer komplexere Tarif-Modelle.
- Kirchenkreis-Hierarchie (parent_organization_id, Bundle-Limits) — nach Launch.
- Automatische Upgrade-/Billing-Anbindung — out of scope, manuell via super_admin.

</deferred>
