-- Audit 03.07.2026 (Achse 1, F7): Fehlende FKs auf Chat-Spalten — das
-- Aufraeumen lief bisher rein prozedural in den Handlern (funktionierte,
-- 0 Waisen im Bestand, aber ohne DB-Netz). Die CASCADE-Regeln spiegeln
-- exakt das heutige Handler-Verhalten.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_messages_user') THEN
    ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_participants_user') THEN
    ALTER TABLE chat_participants ADD CONSTRAINT fk_chat_participants_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_rooms_event') THEN
    ALTER TABLE chat_rooms ADD CONSTRAINT fk_chat_rooms_event
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;
