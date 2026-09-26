-- Klartext-Passwoerter aus der SQLite-Zeit leeren (26.09.2026)
--
-- BEFUND (Audit 26.09.2026, Sicherheit BF-06, Datenbank BF-06, Sammelbefund
-- S-01; HOCH, KRITISCH falls in Produktion befuellt): konfi_profiles traegt
-- seit der SQLite-Zeit die Spalte password_plain. Heute liest sie keine
-- Code-Stelle mehr, und geschrieben wird nur NULL -- ausschliesslich dann,
-- wenn die Leitung ein neues Einmalpasswort erzeugt
-- (routes/konfi-management.js, regenerate-password). Jede Zeile, deren
-- Passwort seither nie neu gesetzt wurde, behaelt ihren alten Stand: im
-- schlimmsten Fall das Klartext-Passwort eines Kindes. Mit jedem Dump
-- wandert er in jede Sicherung.
--
-- ADDITIV: nur Werte, keine Struktur. Die Spalte bleibt, weil das
-- Produktionsschema (tests/schema/prod-schema.sql), die Neuinstallation
-- (init-scripts) und der Drift-Test (tests/schema/schemaDrift.test.js) sie
-- kennen und Migrationen nach der Regel in CLAUDE.md erst erweitern und
-- spaeter abbauen. DROP COLUMN folgt in einer eigenen Migration, sobald
-- dieser Stand ueberall durch ist und keine App-Version im Feld mehr
-- laeuft, die den alten Weg gehen koennte -- gelesen hat die Spalte ohnehin
-- nie ein Client.
--
-- VOR DEM DEPLOY ZAEHLEN (Bericht, "Auf Produktion nachzumessen" Nr. 1):
--   SELECT COUNT(*) FROM konfi_profiles WHERE password_plain IS NOT NULL;
-- Die Migration loescht die Werte, nicht die Frage: Die Zahl entscheidet,
-- ob die Sicherungen, in denen sie bis heute stehen, zu bewerten sind.
--
-- IDEMPOTENT: Ein zweiter Lauf findet keine Zeile mehr.

UPDATE konfi_profiles
   SET password_plain = NULL
 WHERE password_plain IS NOT NULL;
