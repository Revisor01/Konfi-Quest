-- 192: Wunschlizenz in der Anfrage vom Formular auf konfi-quest.de
-- (Simon, 03.10.2026).
--
-- Die Gemeinde waehlt beim Anfragen die Lizenz, die sie nach der Testphase
-- haben moechte. Die Support-Ansicht zeigt sie und belegt damit das
-- Konfi-Limit nach der Testphase vor (frontend/src/utils/konfiLimitVorgabe.ts).
--
-- Werte wie backend/utils/lizenzen.js (LIZENZ_SCHLUESSEL); NULL = keine
-- Angabe ("Noch offen"). tests/utils/lizenzen.test.js haelt den CHECK und
-- die Liste zusammen.
--
-- ADDITIV: neue, nullbare Spalte. Bestehende Anfragen behalten NULL, alte
-- Server-Staende lesen die Spalte nicht (die Liste der Support-Ansicht nennt
-- ihre Felder einzeln). IDEMPOTENT: ADD COLUMN IF NOT EXISTS, der CHECK nur
-- ohne vorhandenen gleichen Namen.

ALTER TABLE gemeinde_anfragen ADD COLUMN IF NOT EXISTS wunsch_lizenz TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.gemeinde_anfragen'::regclass
       AND conname = 'gemeinde_anfragen_wunsch_lizenz_gueltig'
  ) THEN
    ALTER TABLE gemeinde_anfragen
      ADD CONSTRAINT gemeinde_anfragen_wunsch_lizenz_gueltig
      CHECK (wunsch_lizenz IS NULL OR wunsch_lizenz IN ('klein', 'standard', 'plus', 'gross', 'verbund'));
  END IF;
END $$;
