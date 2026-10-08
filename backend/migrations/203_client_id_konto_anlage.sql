-- 203: Wiederholungsschutz fuer die Konfi-Anlage (offene Befunde, Grundgeruest
-- BF-02, Rest; 08.10.2026). Fortsetzung von 201 (Bonuspunkte, Events).
--
-- Kam POST /admin/konfis an und ging nur die Antwort verloren, legte ein
-- zweiter Versuch ein zweites Konto an ("lena.muster2"). Mit einer client_id
-- (UUID, vom Anlage-Fenster der App einmal erzeugt) erkennt der Server den
-- zweiten Eingang und gibt dasselbe Konto zurueck.
--
-- An users, nicht an konfi_profiles: angelegt wird das Konto; die Rueckgabe
-- prueft last_login_at und deleted_at, die dort stehen.
--
-- Eindeutig je Gemeinde (organization_id, client_id), wie in 201: Eine
-- Kollision mit einer fremden Gemeinde verriete sonst, dass es dort ein Konto
-- mit dieser Kennung gibt.
--
-- Event-Serien brauchen keine neue Spalte: Ihre Kennung steht in
-- events.client_id (201) am ersten Termin, dem Anker der Serie.
--
-- ADDITIV: neue, leere Spalte; Store-Apps schicken keine client_id und
-- verhalten sich wie vorher. Die Antwort der Route bleibt unveraendert.
--
-- IDEMPOTENT: IF NOT EXISTS.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_client_id
  ON users (organization_id, client_id)
  WHERE client_id IS NOT NULL;
