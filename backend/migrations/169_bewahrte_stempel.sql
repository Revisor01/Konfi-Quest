-- 169_bewahrte_stempel.sql
--
-- STEMPEL DES TEAMS UEBERLEBEN DAS LOESCHEN IHRER CHALLENGE (28.09.2026).
--
-- Simon, 28.09.2026: "Loeschen muss auch challenges mit umfassen. Teamer und
-- Admins sollten aber ihre Stempel behalten aus den Challenges."
--
-- Ein Stempel ist bisher KEIN gespeicherter Wert. Er wird abgeleitet: Eine
-- Person hat den Stempel einer Challenge, wenn ein eigener Beitrag mit
-- moderation_status = 'approved' existiert; Symbol und Name (badge_icon,
-- badge_name) stehen an der Challenge (routes/challenges.js, Kopf). Seit dem
-- 28.09.2026 loescht DELETE /admin/jahrgaenge/:id die Challenges, die nur an
-- diesem Jahrgang haengen -- mit ihnen gingen per ON DELETE CASCADE die
-- Beitraege und damit die Stempel.
--
-- Diese Tabelle haelt den Stempel fest, BEVOR die Challenge geht
-- (utils/challengeLoeschen.js, bewahreTeamStempel): eine Zeile je Person und
-- Challenge mit allem, was die Anzeige braucht. challenge_id wird mit dem
-- Loeschen NULL; herkunft_challenge_id behaelt die alte Kennung, damit die
-- Antwort der Stempel-Listen ihren Typ behaelt (challenge_id bleibt eine
-- Zahl -- die Apps im Store nutzen sie als Schluessel der Kachel).
--
-- ALT-APP-VERTRAG: rein additiv. Keine bestehende Tabelle aendert sich.

CREATE TABLE IF NOT EXISTS bewahrte_stempel (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  challenge_id INTEGER REFERENCES challenges(id) ON DELETE SET NULL,
  herkunft_challenge_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  badge_icon VARCHAR(50) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  earned_at TIMESTAMPTZ,
  bewahrt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, herkunft_challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_bewahrte_stempel_person
  ON bewahrte_stempel(user_id, organization_id);

COMMENT ON TABLE bewahrte_stempel IS
  'Challenge-Stempel des Teams, festgehalten beim Loeschen ihrer Challenge mit dem Jahrgang (Simon, 28.09.2026). Ein lebender Stempel wird weiter aus challenge_submissions abgeleitet.';
