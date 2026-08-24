-- Musik-Links in Challenge-Beitraegen (Entscheid 24.08.2026):
-- Link-Beitraege sind auf Musikdienste beschraenkt (Spotify, Apple Music,
-- YouTube Music, Deezer) — die Erlaubnisliste liegt in utils/musikLinks.js.
-- Beim Einreichen holt der Server EINMALIG Titel und Interpret (oEmbed bzw.
-- iTunes-Lookup) und legt sie hier ab.
--
-- BEWUSST kein Cover und keine Bild-URL: Beim Betrachten der Beitraege soll
-- kein Musikdienst kontaktiert werden — nur der Server fragt beim Einreichen
-- einmal an (Datenschutzentscheid). Alt-Beitraege behalten NULL; die Anzeige
-- faellt dann auf die Domain zurueck.
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS link_title TEXT;
ALTER TABLE challenge_submissions ADD COLUMN IF NOT EXISTS link_author TEXT;
