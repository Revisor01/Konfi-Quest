### Phase 115 [ABGESCHLOSSEN]: Konfi-Limits pro Org (Tarif-Durchsetzung)

**Goal:** Pro Organisation ein Konfi-Limit (`max_konfis`) durchsetzen, damit die Preistabelle technisch wirksam wird. Nur `super_admin` setzt das Limit pro Org (passend zum gekauften Tarif); Org-Admins sehen es nur. Gezaehlt werden ausschliesslich Konfis (Rolle konfi) — Teamer:innen + Admins unbegrenzt. Grace-Verhalten beim Konfi-Anlegen: unter Limit normal; ab Limit Hinweis-Banner; zwischen Limit und Limit+5 Anlegen nur mit aktiver Bestaetigung ("Trotzdem anlegen"); ab Limit+5 harte Grenze (verweigert, Upgrade noetig). Echte Multi-Tenancy bleibt (eine DB, organization_id) — KEINE neue DB pro Kunde.
**Requirements**: super_admin setzt max_konfis pro Org; nur Konfis zaehlen; 3-Stufen-Grace (ok / grace+bestaetigen / hart blocken bei +5); Org-Admin sieht Limit read-only; Tests mitschreiben.
**Depends on:** Phase 114
**Plans:** 3 plans in 3 waves

Plans:
- [x] 115-01-PLAN.md (Wave 1) — Fundament: Migration 083 (organizations.max_konfis NULL) + gemeinsame Util checkKonfiLimit (Single Source of Truth) + super_admin-only PATCH /:id/limit
- [x] 115-02-PLAN.md (Wave 2) — Durchsetzung beider Anlage-Wege: 3-Stufen-Grace in POST-Konfi-Route (201/409/403) + Hard-Block in Invite-Registrierung
- [x] 115-03-PLAN.md (Wave 3) — Frontend: max_konfis-Feld (nur super_admin), read-only "X von Y Konfis", Grace-Bestaetigungsdialog + Hard-Block-Hinweis (haengt an 02 wegen Response-Struktur)

### Phase 116: Badge-System-Audit + Pflicht-Anwesenheits-Badges (Anzahl, Teamer-Jahre)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 115
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 116 to break down)
