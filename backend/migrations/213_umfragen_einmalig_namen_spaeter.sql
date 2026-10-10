-- 213: Umfragen mit einmaliger Antwort und später aufgedeckten Namen (10.10.2026)
--
-- Simon, 10.10.2026: „wir brauchen bei umfragen eine option, dass man seine
-- einmal eingeloggt antwort nicht mehr ändern kann. etwa für ein quiz […]
-- und erst danach die namen revealen."
--
--   einmalige_antwort    Wer abgestimmt hat, kann die Stimme weder ändern
--                        noch zurücknehmen (POST /chat/polls/:id/vote).
--   namen_spaeter        Die Namen der Abstimmenden kommen erst nach dem
--                        Aufdecken. Gespeichert wird dabei anonymous = true:
--                        Wer die neuen Spalten nicht kennt (ein alter
--                        Backend-Container im rollenden Deploy), behandelt die
--                        Umfrage als anonym und gibt keine Namen heraus.
--   namen_aufgedeckt_at  Wann die Namen von Hand aufgedeckt wurden. Nach dem
--                        Ablauf (expires_at) gelten sie ohne Eintrag als
--                        aufgedeckt; das rechnet die Route beim Lesen aus,
--                        ein Zeitplan-Lauf ist nicht nötig.
--
-- ADDITIV: drei neue Spalten mit Default, keine bestehende ändert sich. Die
-- Store-Apps (2.2.x, 2.3.0) lesen die Antwortformen unverändert; neue Felder
-- kommen nur hinzu.
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS.

ALTER TABLE chat_polls ADD COLUMN IF NOT EXISTS einmalige_antwort BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_polls ADD COLUMN IF NOT EXISTS namen_spaeter BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_polls ADD COLUMN IF NOT EXISTS namen_aufgedeckt_at TIMESTAMPTZ;
