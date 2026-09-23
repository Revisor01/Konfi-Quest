-- 156_push_tokens_app_version.sql
--
-- WELCHE APP-FASSUNG HAT DEN TOKEN GESCHICKT?
--
-- Am 23.09.2026 hat eine Fehlersuche Stunden gekostet, weil diese Frage nicht
-- zu beantworten war. Ein Tester meldete, seit Wochen keine Push-Nachrichten
-- auf Android zu bekommen. Es gab drei Anmeldungen (18:25, 18:30, 20:14 Uhr),
-- in den Server-Logs keinen einzigen POST /device-token und keinen Fehler --
-- und keine Moeglichkeit festzustellen, ob auf dem Geraet die korrigierte
-- Fassung lief oder noch die alte vom 27.08.
--
-- Jede Vermutung darueber war unpruefbar: "Fix greift nicht" und "Fix ist noch
-- nicht auf dem Geraet" sehen serverseitig identisch aus. Genau diese
-- Unterscheidung entscheidet aber, ob man weitersucht oder wartet.
--
-- Deshalb schreibt die App ihre Fassung ab jetzt bei jeder Registrierung mit.
--
-- ADDITIV, mit Absicht nullbar:
--   * Ausgelieferte App-Versionen kennen das Feld nicht und schicken es nicht.
--     Ihre Registrierungen muessen weiter funktionieren -- NULL heisst dann
--     "unbekannt, Fassung vor dem 23.09.2026", nicht "Fehler".
--   * Kein Default: Ein erfundener Wert waere schlimmer als eine Luecke, weil
--     er nach einer echten Angabe aussieht.
--
-- app_version   die Marketing-Version, z.B. '2.3.0'
-- app_build     die Build-Nummer als Text, z.B. '117' (Android versionCode)
--               oder '211' (iOS). Text, weil die beiden Plattformen
--               unterschiedlich zaehlen und ein INTEGER hier nichts gewinnt.

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS app_build TEXT;

COMMENT ON COLUMN push_tokens.app_version IS
  'Marketing-Version der App, die diesen Token geschickt hat (z.B. 2.3.0). NULL = Fassung vor 23.09.2026.';
COMMENT ON COLUMN push_tokens.app_build IS
  'Build-Nummer der App als Text (Android versionCode bzw. iOS CFBundleVersion). NULL = Fassung vor 23.09.2026.';
