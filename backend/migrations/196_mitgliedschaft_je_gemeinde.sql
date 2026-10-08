-- 196: Kontofelder je Gemeinde (Simon, 08.10.2026; docs/planung/mehrfach-konten.md,
-- Entscheidungen 5 bis 7).
--
-- Wer in mehreren Gemeinden mitarbeitet, hat in jeder Gemeinde eine eigene
-- Funktionsbezeichnung (role_title), ein eigenes "Teamer:in seit"
-- (teamer_since) und eine eigene Sperre (is_active). Bis hierher standen alle
-- drei nur am Konto (users) und galten in jeder Gemeinde: Sperrte Gemeinde A
-- eine Person, war sie auch in B gesperrt.
--
-- 1. user_organizations bekommt die drei Spalten. is_active NOT NULL mit
--    Vorgabe true (wie der Normalfall); die beiden anderen ohne Pflichtwert.
-- 2. Altbestand der WEITEREN Gemeinden: Die Werte vom Konto werden einmal
--    uebernommen (nur beim ersten Lauf, wenn die Spalten gerade entstehen --
--    ein zweiter Lauf ueberschreibt keinen inzwischen gepflegten Wert). So
--    zeigt jede Gemeinde zunaechst, was sie bisher auch gezeigt hat.
-- 3. Stamm-Zeilen (Entscheidung 5): Migration 101 hat jedes damalige Konto mit
--    seiner Stamm-Gemeinde auch in user_organizations eingetragen; aeltere
--    Rollenwechsel liessen dort die alte Rolle stehen. Jede vorhandene
--    Stamm-Zeile wird auf den Stand am Konto gesetzt (role_id, role_title,
--    teamer_since, is_active). Gemessen 01.10.2026: Bei keinem aktiven Konto
--    weicht die Rolle ab -- die Angleichung ist die Absicherung. Fehlende
--    Stamm-Zeilen werden NICHT angelegt: Fuer die Stamm-Gemeinde gelten die
--    Felder am Konto; eine Stamm-Zeile entsteht erst, wenn die Stamm-Gemeinde
--    die Person nur fuer sich sperrt (utils/orgMitglieder.js,
--    schreibeGemeindeFelder).
--
-- WAS GILT DANACH (utils/orgMitglieder.js):
--   - Stamm-Gemeinde: role_id, role_title, teamer_since am Konto; jede
--     Aenderung schreibt Konto UND eine vorhandene Stamm-Zeile.
--   - weitere Gemeinde: die Werte in ihrer Zeile.
--   - Sperre: users.is_active = false sperrt das ganze Konto (Anmeldung
--     scheitert). user_organizations.is_active = false sperrt die Person nur
--     in dieser Gemeinde. Ist sie in allen gesperrt, wird auch das Konto
--     gesperrt.
--
-- ADDITIV: drei neue Spalten mit Vorgabe bzw. ohne Pflichtwert; die Spalten
-- am Konto bleiben und werden weiter gepflegt. Ein alter Server-Stand liest
-- die neuen Spalten nicht und arbeitet wie bisher. Die Angleichung der
-- Stamm-Zeilen setzt nur, was am Konto ohnehin gilt.
--
-- SPERRE: ADD COLUMN mit konstanter Vorgabe aendert nur den Katalog
-- (Postgres >= 11), kein Umschreiben der Tabelle; die UPDATEs fassen nur
-- user_organizations an (in Produktion wenige hundert Zeilen).
--
-- IDEMPOTENT: Spalten, Uebernahme und Angleichung nur, wenn role_title noch
-- fehlt. Ein zweiter Lauf aendert nichts -- er setzte sonst eine inzwischen
-- nur in der Stamm-Gemeinde gesetzte Sperre wieder auf den Stand am Konto
-- zurueck (tests/schema/migration196MitgliedschaftJeGemeinde.test.js).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_organizations'
       AND column_name = 'role_title'
  ) THEN
    ALTER TABLE user_organizations
      ADD COLUMN role_title text,
      ADD COLUMN teamer_since date,
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;

    -- Weitere Gemeinden: Werte vom Konto einmal uebernehmen.
    UPDATE user_organizations uo
       SET role_title = u.role_title,
           teamer_since = u.teamer_since,
           is_active = COALESCE(u.is_active, true)
      FROM users u
     WHERE u.id = uo.user_id
       AND uo.organization_id IS DISTINCT FROM u.organization_id;

    -- Stamm-Zeilen auf den Stand am Konto.
    UPDATE user_organizations uo
       SET role_id = u.role_id,
           role_title = u.role_title,
           teamer_since = u.teamer_since,
           is_active = COALESCE(u.is_active, true)
      FROM users u
     WHERE u.id = uo.user_id
       AND uo.organization_id = u.organization_id;
  END IF;
END $$;
