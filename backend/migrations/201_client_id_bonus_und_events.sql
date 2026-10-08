-- 201: Wiederholungsschutz fuer Bonuspunkte und Events (offene Befunde,
-- Grundgeruest BF-02, Rest; 08.10.2026).
--
-- Die App reiht Bonuspunkte und neue Events offline in ihre Warteschlange ein,
-- und die wiederholt bei Netzfehler, Zeitlimit und 5xx. Kam die erste Anfrage
-- an und ging nur die Antwort verloren, entstanden Bonuspunkte bzw. ein Event
-- doppelt. Mit einer client_id (UUID, von der App je Vorgang einmal erzeugt)
-- erkennt der Server den zweiten Eingang -- dasselbe Muster wie
-- activity_requests.client_id und chat_messages.client_id.
--
-- Eindeutig je Gemeinde (organization_id, client_id): Ein zweiter Eingang wird
-- nur in derselben Gemeinde nachgeschlagen; eine Kollision mit einer fremden
-- Gemeinde verriete sonst, dass es dort einen Vorgang mit dieser Kennung gibt.
--
-- ADDITIV: neue, leere Spalten; Store-Apps schicken keine client_id und
-- verhalten sich wie vorher. Die Antworten der Routen bleiben unveraendert.
--
-- IDEMPOTENT: IF NOT EXISTS.

ALTER TABLE bonus_points
  ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_points_org_client_id
  ON bonus_points (organization_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_org_client_id
  ON events (organization_id, client_id)
  WHERE client_id IS NOT NULL;
