-- 211: Fremdschluessel und die Schluessel, auf die sie zeigen, werden bigint
-- (10.10.2026, Datenbank BF-12, Rest).
--
-- BEFUND: Die Primaerschluessel ab Migration 068 sind bigint, aber 75
-- Fremdschluessel-Paare mischten noch integer hinein -- meist ein integer-
-- Fremdschluessel auf einen bigint-Schluessel, dazu sieben Tabellen, deren
-- Schluessel selbst noch integer ist (challenges, levels, konfsprueche,
-- materials, certificate_types, invite_codes, wrapped_ausgaben; ihre
-- Sequenzen ebenso). Bei 2^31 Zeilen waere Schluss -- fern bei heutigem
-- Bestand, aber die Umstellung schreibt jede betroffene Tabelle unter Sperre
-- neu, und das kostet mit jeder Gemeinde mehr. Deshalb jetzt, vor der
-- EKD-weiten Ausrollung.
--
-- WAS: jede Spalte, die auf einer Seite eines Fremdschluessels steht und
-- integer ist, dazu bewahrte_stempel.herkunft_challenge_id (traegt eine
-- challenges.id, ohne Constraint, weil der Stempel die Challenge
-- ueberdauert). Die Liste ergibt sich aus pg_constraint, nicht aus einer
-- Aufzaehlung: So erwischt die Migration auch eine Instanz, deren Schema
-- abweicht. In der Produktion am 10.10.2026: 75 Paare, 76 Spalten in 31
-- Tabellen, davon 7 Primaerschluessel mit Sequenz.
--
-- ANTWORTFORM: unveraendert. node-pg liefert int8 von Haus aus als
-- Zeichenkette; database.js setzt dafuer seit jeher
-- types.setTypeParser(20, parseInt) -- die Primaerschluessel sind laengst
-- bigint und kommen als Zahl an. Geprueft, dass keine Abfrage die Spalten
-- so verarbeitet, dass der Typ durchschlaegt: SUM ueber eine Kennung (gaebe
-- numeric = Zeichenkette) gibt es nicht; ARRAY_AGG/ARRAY(SELECT ...) gibt es
-- nur ueber Spalten, die schon bigint sind, oder mit ::int[]. Der Test
-- tests/routes/kennungenAlsZahl.test.js haelt das an Antworten fest.
--
-- SPERRE: ALTER COLUMN TYPE schreibt die Tabelle neu und baut ihre Indizes
-- (ACCESS EXCLUSIVE bis zum Ende der Transaktion), je Tabelle EINMAL fuer
-- alle ihre Spalten; ein umgestellter Primaerschluessel prueft dabei die
-- Fremdschluessel der Tabellen, die auf ihn zeigen, noch einmal. Die 31
-- Tabellen sind in der Produktion zusammen 5,1 MB gross (groesste:
-- notifications 3.706 Zeilen / 1,6 MB, event_bookings 1.835 / 0,6 MB,
-- refresh_tokens 1.292 / 0,4 MB). Gemessen am 10.10.2026 an einer Kopie der
-- Produktion (lokal, Postgres 15, drei Laeufe): 266 bis 354 ms fuer die ganze
-- Datei, ein zweiter Lauf 5 bis 6 ms. Mit notifications und refresh_tokens
-- auf das 110-Fache (408.000 und 142.000 Zeilen, 338 MB) waren es 4,1 bis
-- 8,0 s -- deshalb vor der EKD-weiten Ausrollung. Der Migrationslauf gibt
-- nach lock_timeout auf und versucht es beim naechsten Start.
--
-- IDEMPOTENT: Umgestellt wird nur, was noch integer ist; ein zweiter Lauf
-- findet nichts (tests/schema/migration211FremdschluesselBigint.test.js).

CREATE OR REPLACE FUNCTION pg_temp.fremdschluessel_bigint()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  tabelle regclass;
  klauseln text;
  ansichten text[][] := '{}';
  a record;
  i int;
BEGIN
  CREATE TEMP TABLE fk_offen ON COMMIT DROP AS
  SELECT DISTINCT seite.rel AS rel, att.attname::text AS spalte, att.attnum AS nr
    FROM pg_constraint k
    CROSS JOIN LATERAL (
      SELECT k.conrelid AS rel, unnest(k.conkey) AS nr
      UNION ALL
      SELECT k.confrelid, unnest(k.confkey)
    ) seite
    JOIN pg_attribute att ON att.attrelid = seite.rel AND att.attnum = seite.nr
   WHERE k.contype = 'f'
     AND k.connamespace = 'public'::regnamespace
     AND att.atttypid = 'int4'::regtype
  UNION
  SELECT att.attrelid, att.attname::text, att.attnum
    FROM pg_attribute att
   WHERE att.attrelid = to_regclass('public.bewahrte_stempel')
     AND att.attname = 'herkunft_challenge_id'
     AND att.atttypid = 'int4'::regtype;

  IF NOT EXISTS (SELECT 1 FROM fk_offen) THEN
    RETURN;
  END IF;

  -- Views, die eine der Spalten lesen, verhindern ALTER COLUMN TYPE: mit
  -- ihrer Definition merken und wegnehmen (Muster: Migration 206).
  FOR a IN
    SELECT DISTINCT v.oid, v.relname
      FROM pg_depend d
      JOIN pg_rewrite rw ON rw.oid = d.objid
      JOIN pg_class v ON v.oid = rw.ev_class AND v.relkind = 'v'
      JOIN fk_offen o ON o.rel = d.refobjid AND o.nr = d.refobjsubid
     WHERE d.classid = 'pg_rewrite'::regclass
       AND v.oid <> d.refobjid
  LOOP
    ansichten := ansichten || ARRAY[[a.relname::text, pg_get_viewdef(a.oid)]];
    EXECUTE format('DROP VIEW public.%I', a.relname);
  END LOOP;

  -- Je Tabelle ein ALTER fuer alle ihre Spalten: die Tabelle wird einmal
  -- neu geschrieben.
  FOR tabelle IN SELECT DISTINCT rel FROM fk_offen LOOP
    SELECT string_agg(format('ALTER COLUMN %I TYPE bigint', spalte), ', ' ORDER BY nr)
      INTO klauseln
      FROM fk_offen WHERE rel = tabelle;
    EXECUTE format('ALTER TABLE %s ', tabelle) || klauseln;
  END LOOP;

  -- Sequenzen der umgestellten Spalten: sonst endet nextval() weiter bei
  -- 2^31 - 1. AS bigint hebt auch ein MAXVALUE, das auf der integer-Grenze
  -- stand.
  FOR a IN
    SELECT s.seqrelid::regclass AS seq
      FROM fk_offen o
      JOIN pg_depend d ON d.refobjid = o.rel AND d.refobjsubid = o.nr
                      AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
      JOIN pg_sequence s ON s.seqrelid = d.objid
     WHERE s.seqtypid <> 'int8'::regtype
  LOOP
    EXECUTE format('ALTER SEQUENCE %s AS bigint', a.seq);
  END LOOP;

  IF array_length(ansichten, 1) IS NOT NULL THEN
    FOR i IN 1 .. array_length(ansichten, 1) LOOP
      EXECUTE format('CREATE VIEW public.%I AS ', ansichten[i][1]) || ansichten[i][2];
    END LOOP;
  END IF;
END
$fn$;

SELECT pg_temp.fremdschluessel_bigint();
