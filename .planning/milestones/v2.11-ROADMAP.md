### Phase 115 [ABGESCHLOSSEN]: Konfi-Limits pro Org (Tarif-Durchsetzung)

**Goal:** Pro Organisation ein Konfi-Limit (`max_konfis`) durchsetzen, damit die Preistabelle technisch wirksam wird. Nur `super_admin` setzt das Limit pro Org (passend zum gekauften Tarif); Org-Admins sehen es nur. Gezaehlt werden ausschliesslich Konfis (Rolle konfi) — Teamer:innen + Admins unbegrenzt. Grace-Verhalten beim Konfi-Anlegen: unter Limit normal; ab Limit Hinweis-Banner; zwischen Limit und Limit+5 Anlegen nur mit aktiver Bestaetigung ("Trotzdem anlegen"); ab Limit+5 harte Grenze (verweigert, Upgrade noetig). Echte Multi-Tenancy bleibt (eine DB, organization_id) — KEINE neue DB pro Kunde.
**Requirements**: super_admin setzt max_konfis pro Org; nur Konfis zaehlen; 3-Stufen-Grace (ok / grace+bestaetigen / hart blocken bei +5); Org-Admin sieht Limit read-only; Tests mitschreiben.
**Depends on:** Phase 114
**Plans:** 3 plans in 3 waves

Plans:
- [x] 115-01-PLAN.md (Wave 1) — Fundament: Migration 083 (organizations.max_konfis NULL) + gemeinsame Util checkKonfiLimit (Single Source of Truth) + super_admin-only PATCH /:id/limit
- [x] 115-02-PLAN.md (Wave 2) — Durchsetzung beider Anlage-Wege: 3-Stufen-Grace in POST-Konfi-Route (201/409/403) + Hard-Block in Invite-Registrierung
- [x] 115-03-PLAN.md (Wave 3) — Frontend: max_konfis-Feld (nur super_admin), read-only "X von Y Konfis", Grace-Bestaetigungsdialog + Hard-Block-Hinweis (haengt an 02 wegen Response-Struktur)

### Phase 116 [ABGESCHLOSSEN]: Badge-System-Audit + Pflicht-Anwesenheits-Badges (Anzahl, Teamer-Jahre)

**Goal:** Badge-System um zwei Typen erweitern + Prozent-Bug fixen. (1) Pflicht-Anwesenheits-Badge: neuer criteria_type `mandatory_event_count`, zaehlt nur ANZAHL besuchter Events mit mandatory=true (attendance_status='present'), Schwellwert frei + nachtraeglich korrigierbar, kein Entzug. (2) Teamer-Jahre-Badge (existiert): Startjahr-Fix auf users.teamer_since statt nicht-existenter user_role_history. (3) Prozent-Bug: fehlende Progress-Cases (event_count/teamer_year/mandatory_event_count) + Extra-Feld-Mismatch (specific_activity/activity_combination) in konfi.js beheben. KEINE Schema-Migration noetig. Audit: 116-AUDIT.md.
**Requirements**: mandatory_event_count criteria_type (nur Events, nur Anzahl); Leitung setzt/korrigiert Schwellwert ohne Entzug; teamer_year Startjahr ab teamer_since; Prozent-Fix fehlende Cases + Extra-Feld-Mismatch; Teamer-vs-Konfi getrennt (target_role); Tests mitschreiben.
**Depends on:** Phase 115
**Plans:** 3 plans in 1 wave

Plans:
- [x] 116-01-PLAN.md (Wave 1) — Backend-Wertung: mandatory_event_count (neuer Typ + Case) + teamer_year-Startjahr auf teamer_since (badges.js)
- [x] 116-02-PLAN.md (Wave 1) — Prozent-Bug-Fix: fehlende Progress-Cases + Extra-Feld-Mismatch (konfi.js) + teamer_year-Progress Startjahr (teamer.js)
- [x] 116-03-PLAN.md (Wave 1) — Frontend: mandatory_event_count im Badge-Modal freischalten (Konfi-only, Label, Farbe)
