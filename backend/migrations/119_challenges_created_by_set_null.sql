-- 119_challenges_created_by_set_null.sql
-- Security-Review-Befund: challenges.created_by referenzierte users(id) ohne
-- Loesch-Regel (NO ACTION). Sobald ein Teamer/Admin eine Challenge angelegt
-- hatte, blockierte der FK das Loeschen dieses Users (und damit auch die
-- Org-Loeschung, die Users VOR der Organisation entfernt) mit einem 500.
-- Gleiches Muster wie chat_rooms.created_by: Urheber-Referenz wird beim
-- User-Delete auf NULL gesetzt, die Challenge bleibt erhalten.

ALTER TABLE challenges ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_created_by_fkey;
ALTER TABLE challenges ADD CONSTRAINT challenges_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
