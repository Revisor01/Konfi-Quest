-- 122_challenges_audience_default_team.sql
-- Nachschaerfung zu Migration 121 (User-Entscheid 09.08.2026):
-- Das Team ist IMMER dabei. Es gibt keinen Grund, Pastor:innen und
-- Teamer:innen vom Mitschreiben auszuschliessen — "Mitmachen ist immer besser
-- als nur außen stehen". Die Option "nur Konfis" entfaellt deshalb aus der UI.
--
-- Konsequenz hier:
--   1. Neuer Spalten-Default 'konfis_und_team' (statt 'konfis').
--   2. Bestandsdaten werden mitgezogen: 'konfis' -> 'konfis_und_team'.
--      Das erweitert nur den Kreis der EINREICHENDEN (das Team kommt hinzu);
--      an der Sichtbarkeit fuer die Konfis aendert sich nichts, und niemandem
--      wird etwas weggenommen.
--
-- 'konfis' bleibt im CHECK-Constraint erlaubt: die Route akzeptiert den Wert
-- weiterhin (Alt-Clients, API-Kompatibilitaet), die UI bietet ihn nur nicht an.

ALTER TABLE challenges
  ALTER COLUMN audience SET DEFAULT 'konfis_und_team';

UPDATE challenges
  SET audience = 'konfis_und_team'
  WHERE audience = 'konfis';
