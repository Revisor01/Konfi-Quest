-- Sequenzen von user_badges und user_activities nach ihren Tabellen benennen
-- (29.09.2026)
--
-- BEFUND (Audit 26.09.2026, Datenbank BF-12): Migration 076 hat konfi_badges
-- und konfi_activities in user_badges und user_activities umbenannt, ihre
-- Sequenzen nicht. user_badges.id lief weiter ueber konfi_badges_id_seq,
-- user_activities.id ueber konfi_activities_id_seq -- wer eine Sequenz nach
-- dem Tabellennamen sucht, findet sie nicht.
--
-- WIRKUNG: nur der Name. Der Default nextval('...'::regclass) verweist per
-- OID auf die Sequenz und zeigt danach den neuen Namen; Besitz (OWNED BY) und
-- Zaehlerstand bleiben. Keine Code-Stelle nennt die alten Namen (geprueft:
-- Routen, Dienste, Hilfen, Test-Helfer, E2E). Auch eine alte Server-Fassung
-- im Deploy merkt nichts.
--
-- Die Typmischung integer/bigint an 55 Fremdschluesseln bleibt (siehe
-- Bericht); neue Migrationen legen Fremdschluessel als BIGINT an
-- (tests/schema/migrationenKonventionen.test.js).
--
-- SPERRE: ALTER SEQUENCE RENAME, ein Katalogeintrag; Lastbestand 18-40 ms
-- (drei Laeufe, samt Verbindungsaufbau).
--
-- IDEMPOTENT: nur, solange der alte Name da ist und der neue frei.

DO $$
BEGIN
  IF to_regclass('public.konfi_badges_id_seq') IS NOT NULL
     AND to_regclass('public.user_badges_id_seq') IS NULL THEN
    ALTER SEQUENCE konfi_badges_id_seq RENAME TO user_badges_id_seq;
  END IF;
  IF to_regclass('public.konfi_activities_id_seq') IS NOT NULL
     AND to_regclass('public.user_activities_id_seq') IS NULL THEN
    ALTER SEQUENCE konfi_activities_id_seq RENAME TO user_activities_id_seq;
  END IF;
END $$;
