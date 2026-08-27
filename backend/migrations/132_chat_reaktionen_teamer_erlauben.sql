-- 132_chat_reaktionen_teamer_erlauben.sql
--
-- Teamer:innen konnten auf keine Chat-Nachricht reagieren: der Reaktionsknopf
-- war fuer sie sichtbar, das Speichern schlug aber immer fehl.
--
-- Befund HOCH (Chat-Pruefauftrag 27.08.2026): POST /chat/messages/:id/reactions
-- speichert user_type aus req.user.type. Fuer Teamer:innen ist das laut
-- middleware/rbac.js und utils/jahrgangChat.js roleToParticipantType der Wert
-- 'teamer'. Der CHECK an chat_message_reactions kannte aber nur 'admin' und
-- 'konfi' -- jeder Teamer-Klick lief in eine Constraint-Verletzung und die
-- Route antwortete mit 500. Admin und Konfi funktionierten.
--
-- Die Nachbartabellen chat_participants und chat_read_status fuehren 'teamer'
-- laengst als eigenen Wert (siehe Migration 098 und 117). Der Reaktions-CHECK
-- war als einziger nicht mitgezogen worden. Nachbarschaft geprueft
-- (27.08.2026): chat_message_reactions ist die EINZIGE Tabelle mit einem
-- user_type-CHECK, der 'teamer' vergisst. chat_participants und
-- chat_read_status fuehren alle drei Werte; chat_messages, chat_poll_votes,
-- password_resets und push_tokens haben ueberhaupt keinen CHECK auf user_type.
--
-- VOR DEM AUSROLLEN GEGEN PRODUKTION GEGENPRUEFEN: Der alte Constraint-Wortlaut
-- stammt aus backend/tests/schema/prod-schema.sql, also aus einem Dump. Der war
-- am 24.08.2026 als deckungsgleich mit Produktion gemessen, ein Beweis fuer den
-- heutigen Live-Stand ist das aber nicht. Pruefen mit:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'chat_message_reactions'::regclass AND contype = 'c';
--
-- Deshalb defensiv formuliert:
--   1. Ein CHECK laesst sich in PostgreSQL nicht aendern -- er muss weg und neu.
--   2. Geloescht wird ueber pg_constraint statt ueber den erwarteten Namen:
--      heisst der Constraint in Produktion anders (oder gibt es mehrere), wird
--      er trotzdem gefunden.
--   3. Idempotent: Erlaubt Produktion 'teamer' bereits, laeuft die Migration
--      trotzdem sauber durch und stellt am Ende denselben Zustand her.
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Alle CHECK-Constraints der Tabelle entfernen, die sich auf user_type
  -- beziehen -- unabhaengig von ihrem Namen.
  FOR constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.chat_message_reactions'::regclass
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%user_type%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.chat_message_reactions DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  -- Neu anlegen mit allen drei Werten, die der Code tatsaechlich schreibt.
  ALTER TABLE public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_user_type_check
    CHECK (user_type IN ('admin', 'teamer', 'konfi'));
END $$;
