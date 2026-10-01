-- In konfi_profiles.password_plain kann kein Klartext mehr landen (29.09.2026)
--
-- BEFUND (Audit 26.09.2026, Datenbank BF-06 / Sicherheit BF-06): Die Spalte
-- stammt aus der SQLite-Zeit, als Passwoerter von Konfis im Klartext
-- gespeichert und angezeigt wurden. Migration 165 hat die Werte geleert
-- (Produktion vor dem Deploy: 0 von 130 Zeilen mit Wert). Stehen blieb die
-- Spalte -- jede kuenftige Stelle, die wieder hineinschreibt, legte das
-- Passwort eines Kindes in jede Sicherung.
--
-- Ab hier laesst ein CHECK nur NULL zu, und keine Code-Stelle nennt die
-- Spalte mehr (die letzte, ein Leeren in regenerate-password, ist mit
-- diesem Stand entfernt). Keine API-Antwort gab die Spalte seit Maerz 2026
-- zurueck; die Store-App 2.2.0 liest sie nicht.
--
-- WARUM NOCH KEIN DROP COLUMN: Die bisherige Server-Fassung setzt die Spalte
-- beim Erzeugen eines Einmalpassworts auf NULL. Sie laeuft waehrend des
-- rollenden Deploys auf der zweiten Replica weiter und im Test-Backend, bis
-- dessen Image neu gebaut ist. Ohne Spalte bekaeme die Leitung dort einen
-- Fehler; NULL laesst der CHECK zu. Die Spalte entfaellt in einer eigenen
-- Migration, sobald kein Server mit dem Stand vor dem 29.09.2026 mehr laeuft
-- (Waechter fuer die Voraussetzung: tests/schema/migration176KeinKlartext.test.js).
--
-- SPERRE: ADD CONSTRAINT prueft jede Zeile unter ACCESS EXCLUSIVE.
-- Lastbestand (16.000 Profile): 9-24 ms in drei Laeufen.
--
-- IDEMPOTENT: UPDATE findet beim zweiten Lauf nichts, der CHECK wird nur
-- angelegt, wenn es ihn nicht gibt.

-- Seit Migration 187 (01.10.2026) gibt es die Spalte nicht mehr; ein zweiter
-- Lauf der Kette trifft dann nichts (migrationenIdempotent.test.js).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'konfi_profiles'
               AND column_name = 'password_plain') THEN
    UPDATE konfi_profiles SET password_plain = NULL WHERE password_plain IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'public.konfi_profiles'::regclass
                     AND conname = 'konfi_profiles_password_plain_leer') THEN
      ALTER TABLE konfi_profiles
        ADD CONSTRAINT konfi_profiles_password_plain_leer CHECK (password_plain IS NULL);
    END IF;
  END IF;
END $$;
