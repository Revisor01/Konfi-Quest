-- 190_konto_ohne_gemeinde.sql
--
-- Konten ohne Gemeinde fuer den Support (Simon, 03.10.2026;
-- docs/planung/web-version.md, Entscheidungen 11 bis 15): Die Gemeinde am
-- Konto wird optional -- nur fuer Super-Admins --, mit einer gemeindefreien
-- Systemrolle `super_admin`. Keine versteckte Betriebs-Gemeinde.
--
-- VORARBEIT (eigene Commits davor, einzeln ausgeliefert): Die Stellen im
-- Code, die ein Konto mit organization_id NULL falsch behandelten (Vergleiche
-- mit `<>` und `= Spalte`), sind behoben; Anmeldung und Refresh nehmen ein
-- solches Konto nur aus der Web-Version an (kann_ohne_gemeinde).
--
-- 1. Die Systemrolle `super_admin` ohne Gemeinde (roles.organization_id ist
--    schon nullable). users.role_id bleibt NOT NULL: Ein Support-Konto traegt
--    diese Rolle. Sie steht in keiner Rollenliste einer Gemeinde (GET /roles
--    filtert auf organization_id) und laesst sich dort nicht vergeben
--    (checkUserHierarchy: canCreateRole kennt super_admin nur als Ziel, das
--    niemand vergeben darf).
-- 2. Eindeutig je Name unter den Rollen ohne Gemeinde: Der vorhandene
--    UNIQUE (organization_id, name) greift bei NULL nicht.
-- 3. users.organization_id nullable ...
-- 4. ... aber nur fuer Super-Admins: CHECK (organization_id IS NOT NULL OR
--    is_super_admin IS TRUE). is_super_admin ist nullable; NULL zaehlt wie
--    false.
--
-- ADDITIV: Bestehende Zeilen aendern sich nicht; jede hat eine Gemeinde und
-- erfuellt den CHECK. Ein alter Server-Stand (vor dieser Migration) liest
-- nichts, was es nicht schon gab -- ein Konto ohne Gemeinde entsteht erst
-- ueber die neuen Routen (POST /organizations/support-konten).
--
-- VORHER IN PRODUKTION LESEND PRUEFEN (Bericht vom 03.10.2026):
--   SELECT id, organization_id, name FROM roles
--    WHERE organization_id IS NULL OR name = 'super_admin';
-- Gibt es schon zwei Rollen `super_admin` ohne Gemeinde, scheitert Schritt 2
-- und die ganze Datei rollt zurueck (der Migrationslauf meldet es in
-- GET /api/status). Gibt es genau eine, wird sie uebernommen, nicht doppelt
-- angelegt.
--
-- SPERRE: ALTER TABLE users nimmt kurz ACCESS EXCLUSIVE; ADD CONSTRAINT
-- prueft dabei jede Zeile. Gemessen am 03.10.2026 auf 20.000 Konten (lokale
-- Test-Datenbank, drei Laeufe): 7,2 bis 8,7 ms fuer die ganze Datei, ein
-- zweiter Lauf 1,5 bis 3,4 ms. Der Migrationslauf gibt nach lock_timeout auf
-- und versucht es beim naechsten Start.
--
-- IDEMPOTENT: INSERT nur ohne vorhandene Rolle, CREATE INDEX IF NOT EXISTS,
-- DROP NOT NULL ist auf einer nullbaren Spalte folgenlos, der CHECK nur ohne
-- gleichnamigen Constraint (tests/schema/migration190KontoOhneGemeinde.test.js).

INSERT INTO roles (organization_id, name, display_name, description, is_system_role, is_active)
SELECT NULL, 'super_admin', 'Super-Admin',
       'Betrieb und Support aller Gemeinden; Konto ohne eigene Gemeinde', true, true
 WHERE NOT EXISTS (
   SELECT 1 FROM roles WHERE organization_id IS NULL AND name = 'super_admin'
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_name_ohne_gemeinde
  ON roles (name) WHERE organization_id IS NULL;

ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass
       AND conname = 'users_gemeinde_oder_super_admin'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_gemeinde_oder_super_admin
      CHECK (organization_id IS NOT NULL OR is_super_admin IS TRUE);
  END IF;
END $$;
