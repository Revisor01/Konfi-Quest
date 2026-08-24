-- Begründung beim Ausblenden eines Challenge-Beitrags (Entscheid 24.08.2026):
-- Die Leitung kann beim Ausblenden OPTIONAL einen Grund angeben, den die
-- einreichende Person bei ihrem eigenen Beitrag sieht ("warum ist das nicht
-- erschienen?"). Optional heisst: Das Ausblenden scheitert NIE daran, dass
-- kein Grund eingetragen wurde (Spalte bleibt dann NULL).
--
-- Beim Freigeben / Wieder-Einblenden wird die Notiz abgeraeumt — sie gehört
-- zum hidden-Zustand wie hidden_by/hidden_at.
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS moderation_note TEXT;
