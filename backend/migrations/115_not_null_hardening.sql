-- Audit 03.07.2026 (Achse 1, F8): Kernspalten erlaubten NULL, obwohl der
-- Bestand 0 NULLs enthielt und NULL fachlich falsch waere. Haertung als
-- eigener Schritt — laeuft in CI gegen die komplette Test-Suite (alle
-- Insert-Pfade). chat_rooms.organization_id setzt Migration 111 voraus
-- (die einzigen NULL-Zeilen waren die dort entfernten Raum-Leichen 50/51).
-- Zusaetzlich: Unique-Guard gegen doppelte Badge-Vergabe (Bestand: 0 Duplikate).

DO $$ BEGIN
  ALTER TABLE chat_messages     ALTER COLUMN room_id  SET NOT NULL;
  ALTER TABLE chat_messages     ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE chat_participants ALTER COLUMN room_id  SET NOT NULL;
  ALTER TABLE chat_participants ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE push_tokens       ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE push_tokens       ALTER COLUMN token    SET NOT NULL;
  ALTER TABLE users             ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE users             ALTER COLUMN role_id         SET NOT NULL;
  ALTER TABLE konfi_profiles    ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE chat_rooms        ALTER COLUMN organization_id SET NOT NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_badges_user_badge
  ON user_badges (user_id, badge_id);
