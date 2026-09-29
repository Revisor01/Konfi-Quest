-- event_bookings.created_at und event_timeslots.created_at: TEXT -> timestamptz
-- (29.09.2026)
--
-- BEFUND (Audit 26.09.2026, Datenbank BF-11): Beide Spalten stammen aus der
-- SQLite-Uebernahme -- TEXT mit Default CURRENT_TIMESTAMP, also eine
-- Zeichenkette in der Zeitzone der schreibenden Sitzung:
-- "2026-09-26 13:53:58.597731+02" aus psql (PGTZ Berlin), "...+00" aus den
-- Backends (UTC), ohne Zone aus der SQLite-Zeit. Sortiert wurde lexikalisch,
-- nach Uhrzeit statt nach Zeitpunkt: Zeilen aus Sitzungen verschiedener
-- Zonen und die doppelte Stunde der Zeitumstellung kamen vertauscht
-- (routes/events/anwesenheit.js, "Alle verbuchen": ORDER BY eb.created_at).
--
-- DEUTUNG EINDEUTIG: Jeder Wert aus Postgres traegt seinen Versatz und wird
-- exakt uebernommen. Werte ohne Zone stammen aus SQLite (CURRENT_TIMESTAMP
-- ist dort UTC) und werden als UTC gelesen -- deshalb SET LOCAL TimeZone.
-- Kein Code schreibt die Spalten ausdruecklich, alle nehmen den Default.
-- Ein Wert, der sich gar nicht als Zeitpunkt lesen laesst, wird NULL, statt
-- die Migration bei jedem Start scheitern zu lassen (Zaehlung vorher:
-- Auftrag 08).
--
-- ANTWORTFORM: GET /events/:id liefert Buchungen (eb.*) und Zeitfenster
-- (et.*) samt created_at. Das Feld bleibt eine Zeichenkette, jetzt im
-- ISO-Format wie alle anderen Zeitfelder; keine App liest es (geprueft: Store
-- 2.2.0 und heutiger Stand). Die View event_booking_stats nutzt die Spalte
-- nicht.
--
-- SPERRE: ALTER COLUMN TYPE schreibt die Tabelle samt Indizes neu (ACCESS
-- EXCLUSIVE). Produktion vor dem Deploy von 2.3.0: 938 Buchungen. Gemessen:
-- 1.000 Buchungen 175-475 ms, 100.000 Buchungen 0,8-2,6 s (je drei bis sechs
-- Laeufe auf einem geteilten Messrechner). Solange sperrt die Migration
-- Buchungen und Zeitfenster; der Lauf gibt nach lock_timeout 10 s auf, wenn
-- er die Sperre nicht bekommt, und versucht es beim naechsten Start.
--
-- IDEMPOTENT: nur, solange die Spalte noch TEXT ist.

SET LOCAL TimeZone = 'UTC';

CREATE OR REPLACE FUNCTION pg_temp.zeitpunkt_oder_null(wert text)
RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN wert::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

DO $$
DECLARE
  tabelle text;
BEGIN
  FOREACH tabelle IN ARRAY ARRAY['event_bookings', 'event_timeslots'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = tabelle
                 AND column_name = 'created_at' AND data_type = 'text') THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at DROP DEFAULT', tabelle);
      BEGIN
        -- Der schnelle Weg: alle Werte lesbar.
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz',
          tabelle);
      EXCEPTION WHEN data_exception THEN
        -- Mindestens ein Wert ist kein Zeitpunkt: Zeile fuer Zeile, der
        -- unlesbare wird NULL. Nur Datenfehler landen hier, keine Sperre.
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN created_at TYPE timestamptz USING pg_temp.zeitpunkt_oder_null(created_at)',
          tabelle);
      END;
      EXECUTE format('ALTER TABLE %I ALTER COLUMN created_at SET DEFAULT now()', tabelle);
    END IF;
  END LOOP;
END $$;
