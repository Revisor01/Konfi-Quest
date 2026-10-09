-- 206: Die letzten 24 Zeitspalten ohne Zeitzone werden timestamptz
-- (09.10.2026, Datenbank BF-11, Rest; Muster: Migration 138).
--
-- BEFUND: 24 Spalten standen auf `timestamp without time zone`. Ihre Werte
-- stimmten nur, weil Datenbank-Sitzungen und Node-Prozess der Backends beide
-- in UTC laufen: Ein Wert ohne Zone ist die Wandzeit der Sitzung, die ihn
-- schrieb. Schreibt eine Sitzung in Berliner Zeit -- psql im
-- Postgres-Container hat PGTZ=Europe/Berlin --, steht dieselbe Uhrzeit fuer
-- einen um ein bis zwei Stunden anderen Zeitpunkt, und nichts in der Zeile
-- verraet es.
--
-- DEUTUNG DES BESTANDS, IN PRODUKTION GEMESSEN (09.10.2026, nur lesend):
-- Grundsaetzlich UTC. Der Schreiber laesst sich je Zeile pruefen, wo eine
-- Spalte mit Zone in derselben Transaktion entstand oder ein Zeitpunkt aus
-- Node danebensteht:
--   - refresh_tokens: expires_at kommt aus Node (UTC), created_at von NOW().
--     1.254 von 1.283 Tokens liegen genau 90 Tage auseinander, 29 genau zwei
--     Stunden weniger -- alle 29 vom 21. bis 23.08.2026, und an diesen Tagen
--     KEIN einziges mit 90 Tagen.
--   - notifications gegen activity_requests.created_at/updated_at und
--     user_badges.awarded_date (beide mit Zone): 1.955 Mitteilungen auf die
--     Mikrosekunde gleich, 75 genau +2 h -- die Kennungen 754 bis 828,
--     21.08. 17:15 bis 23.08. 22:07 (Wandzeit); die Nachbarn davor
--     (19.08.) und danach (24.08. 12:57) wieder gleich.
--   - Erinnerungen "1 Stunde vorher": in diesem Zeitraum 12 von 12 scheinbar
--     NACH Beginn verschickt, sonst nie.
-- Vom 21.08.2026 (vor 15:10 UTC) bis 23.08.2026 (nach 20:07 UTC) liefen also
-- ALLE Sitzungen der Backends in Berliner Zeit. Was in diesem Zeitraum mit
-- NOW()/CURRENT_TIMESTAMP geschrieben wurde, steht als Wandzeit zwischen
-- 21.08. 17:10 und 23.08. 22:08; die Luecken davor (bis 20.08. 21:15) und
-- danach (ab 24.08. 12:57) sind in allen 24 Spalten leer. Die Grenze
-- [21.08. 17:00, 23.08. 22:10] trennt damit eindeutig: 341 Werte in zehn
-- Spalten. Ausgenommen refresh_tokens.expires_at -- es kommt aus Node, wo
-- die Zone der Sitzung nicht wirkt (die 29 Tokens oben beweisen es).
--
-- Dazu von Hand per psql geschrieben (Berliner Sitzung), nachgewiesen ueber
-- denselben Zeitpunkt auf die Mikrosekunde in einer Spalte mit Zone, genau
-- zwei Stunden versetzt, oder ueber den Zeitpunkt des Nachtrags:
--   - levels der Test-Gemeinden 14 und 15 und ihre user_organizations
--     (= organizations.created_at + 2 h), 12 + 2 Zeilen;
--   - die nachgetragenen Level von Hennstedt (Commit a745a9cf, 25.09.2026
--     21:06 Berliner Zeit; die Werte stehen auf 20:55:59), 6 Zeilen;
--   - Material der Demo-Gemeinde (= event_bookings.booking_date + 2 h),
--     3 + 2 Zeilen;
--   - Demo-Mitteilungen der Demo-Gemeinde, alle auf derselben Sekunden-
--     Mikrosekunde ...:49.365759 (NOW() minus ganze Stunden), 14 Zeilen und
--     ein read_at.
-- Zusammen 58 Werte. Andere Treffer gab es nicht: Gegen alle Spalten mit Zone gesucht, kamen
-- nur noch Zufallsgleichheiten runder Werte (volle Stunde) aus der
-- SQLite-Zeit und der Demo-Daten -- sie bleiben UTC.
--
-- ANTWORTFORM: unveraendert. node-pg liest `timestamp` als Ortszeit des
-- Node-Prozesses (Produktion: UTC), `timestamptz` als Zeitpunkt -- beides
-- wird dasselbe Date und dieselbe ISO-Zeichenkette mit `Z`. Kein SQL baut aus
-- diesen Spalten JSON oder Text. Die 341 + 58 Werte oben zeigen danach die
-- richtige Uhrzeit statt einer um zwei Stunden spaeten.
--
-- DEFAULTS: now() und CURRENT_TIMESTAMP liefern timestamptz und bleiben.
-- Anders bonus_points.completed_date und user_activities.completed_date
-- (date, Vorgabe CURRENT_DATE): CURRENT_DATE ist der Tag der Sitzungszone,
-- in den Backends UTC -- zwischen 00:00 und 02:00 Berliner Zeit der Vortag.
-- Bonuspunkte setzen das Datum nicht selbst und nahmen ihn. Neue Vorgabe:
-- der Berliner Tag. Bestand gemessen: 0 von 38 Bonuspunkten und 0 von 544
-- Aktivitaeten tragen den UTC-Vortag ihres created_at.
-- Die View event_booking_stats liest users.deleted_at; sie wird mit ihrer
-- eigenen Definition (pg_get_viewdef) neu angelegt.
--
-- SPERRE: ALTER COLUMN TYPE schreibt die Tabelle neu (ACCESS EXCLUSIVE), je
-- Tabelle EINMAL fuer alle ihre Spalten. Groesste Tabellen am 09.10.2026:
-- notifications 3.425, refresh_tokens 1.283, event_reminders 803 Zeilen.
--
-- IDEMPOTENT: Jede Spalte wird nur umgestellt, solange sie ohne Zone ist;
-- ein zweiter Lauf findet nichts und laesst auch die View stehen.

CREATE OR REPLACE FUNCTION pg_temp.zeitspalten_umstellen()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  -- Wandzeit, in der alle Backend-Sitzungen Berliner Zeit schrieben.
  fenster CONSTANT text := '%1$I BETWEEN ''2026-08-21 17:00'' AND ''2026-08-23 22:10''';
  -- (Tabelle, Spalte, Bedingung fuer "in Berliner Zeit geschrieben").
  -- %1$I ist die Spalte.
  spalten CONSTANT text[][] := ARRAY[
    ['certificate_types',      'created_at', fenster],
    ['chat_message_reactions', 'created_at', fenster],
    ['daily_verses',           'created_at', fenster],
    ['event_reminders',        'sent_at',    fenster],
    ['invite_codes',           'created_at', fenster],
    ['jahrgaenge',             'wrapped_released_at', fenster],
    ['jahrgaenge',             'deletion_reminder_sent_at', fenster],
    ['konfsprueche',           'created_at', fenster],
    ['levels',                 'created_at', fenster || ' OR %1$I IN (''2026-09-25 20:55:59.354073'', ''2026-09-26 02:07:11.742477'', ''2026-09-26 02:07:20.464567'')'],
    ['levels',                 'updated_at', fenster || ' OR %1$I IN (''2026-09-25 20:55:59.354073'', ''2026-09-26 02:07:11.742477'', ''2026-09-26 02:07:20.464567'')'],
    ['material_files',         'created_at', fenster],
    ['material_links',         'created_at', fenster || ' OR %1$I = ''2026-09-04 10:26:59.662153'''],
    ['materials',              'created_at', fenster || ' OR %1$I = ''2026-09-04 10:26:59.662153'''],
    ['materials',              'updated_at', fenster],
    ['notifications',          'created_at', fenster || ' OR (%1$I BETWEEN ''2026-09-18'' AND ''2026-09-26'' AND to_char(%1$I, ''SS.US'') = ''49.365759'')'],
    ['notifications',          'read_at',    fenster || ' OR (%1$I BETWEEN ''2026-09-18'' AND ''2026-09-26'' AND to_char(%1$I, ''SS.US'') = ''49.365759'')'],
    ['organizations',          'license_reminder_sent_at', fenster],
    ['refresh_tokens',         'created_at', fenster],
    ['refresh_tokens',         'expires_at', 'false'],
    ['refresh_tokens',         'revoked_at', fenster],
    ['user_certificates',      'created_at', fenster],
    ['user_organizations',     'created_at', fenster || ' OR %1$I IN (''2026-09-26 02:07:11.742477'', ''2026-09-26 02:07:20.464567'')'],
    ['users',                  'archived_at', fenster],
    ['users',                  'deleted_at', fenster]
  ];
  offen text[] := '{}';
  ansichten text[][] := '{}';
  tabelle text;
  klauseln text;
  i int;
  a record;
BEGIN
  -- Welche der Spalten sind noch ohne Zone?
  FOR i IN 1 .. array_length(spalten, 1) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = spalten[i][1]
                  AND column_name = spalten[i][2]
                  AND data_type = 'timestamp without time zone') THEN
      offen := offen || i::text;
    END IF;
  END LOOP;
  IF cardinality(offen) = 0 THEN
    RETURN;
  END IF;

  -- Views, die eine der Spalten lesen, verhindern ALTER COLUMN TYPE: mit
  -- ihrer Definition merken und wegnehmen.
  FOR a IN
    SELECT DISTINCT v.oid, v.relname
      FROM pg_depend d
      JOIN pg_rewrite rw ON rw.oid = d.objid
      JOIN pg_class v ON v.oid = rw.ev_class AND v.relkind = 'v'
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = d.refobjsubid
     WHERE d.classid = 'pg_rewrite'::regclass
       AND v.oid <> t.oid
       AND t.relnamespace = 'public'::regnamespace
       AND EXISTS (SELECT 1 FROM unnest(offen) o
                    WHERE spalten[o::int][1] = t.relname AND spalten[o::int][2] = att.attname)
  LOOP
    -- relname ist vom Typ name (63 Byte); als text, sonst kuerzt das Feld
    -- auch die Definition daneben.
    ansichten := ansichten || ARRAY[[a.relname::text, pg_get_viewdef(a.oid)]];
    EXECUTE format('DROP VIEW public.%I', a.relname);
  END LOOP;

  -- Je Tabelle ein ALTER fuer alle ihre Spalten: die Tabelle wird einmal
  -- neu geschrieben.
  FOR tabelle IN SELECT DISTINCT spalten[o::int][1] FROM unnest(offen) o LOOP
    SELECT string_agg(format(
             'ALTER COLUMN %1$I TYPE timestamptz USING CASE WHEN ' || spalten[o::int][3]
             || ' THEN %1$I AT TIME ZONE ''Europe/Berlin'' ELSE %1$I AT TIME ZONE ''UTC'' END',
             spalten[o::int][2]), ', ')
      INTO klauseln
      FROM unnest(offen) o
     WHERE spalten[o::int][1] = tabelle;
    EXECUTE format('ALTER TABLE public.%I ', tabelle) || klauseln;
  END LOOP;

  IF array_length(ansichten, 1) IS NOT NULL THEN
    FOR i IN 1 .. array_length(ansichten, 1) LOOP
      EXECUTE format('CREATE VIEW public.%I AS ', ansichten[i][1]) || ansichten[i][2];
    END LOOP;
  END IF;
END
$fn$;

SELECT pg_temp.zeitspalten_umstellen();

ALTER TABLE bonus_points
  ALTER COLUMN completed_date SET DEFAULT ((now() AT TIME ZONE 'Europe/Berlin')::date);
ALTER TABLE user_activities
  ALTER COLUMN completed_date SET DEFAULT ((now() AT TIME ZONE 'Europe/Berlin')::date);
