-- Audit 03.07.2026 (Achse 1, F2): Sieben Kerntabellen hatten KEINEN FK auf
-- organizations(id) — Datenbestand validierte sauber (0 Waisen, 0 NULLs),
-- aber ohne Constraint fehlte das Sicherheitsnetz gegen fehlerhafte Inserts.
-- ON DELETE NO ACTION ist konsistent mit dem prozeduralen Org-Purge in
-- organizations.js (der raeumt alle Kind-Tabellen explizit vor dem Org-Delete).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activities','categories','custom_badges','events','jahrgaenge','event_timeslots','notifications'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_organization') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT fk_%s_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)',
        t, t);
    END IF;
  END LOOP;
END $$;
