-- 210: Einzelspalten-Indizes entfernen, die ein laengerer Index schon traegt
-- (10.10.2026, Datenbank BF-09, Rest).
--
-- BEFUND: Ein B-Baum ueber (a, b) beantwortet jede Abfrage, die ein Index
-- ueber (a) allein beantwortet -- Gleichheit, Bereich, Sortierung nach a.
-- Der Einzelspalten-Index kostet bei jedem INSERT, UPDATE und DELETE einen
-- zweiten Schreibvorgang und Platz, ohne dass der Planer ihn braucht. In der
-- Produktion stehen 28 solche Einzelspalten-Indizes (33 Paare mit einem
-- laengeren); 24 fallen, vier bleiben, siehe AUSGENOMMEN.
--
-- GEMESSEN IN PRODUKTION (10.10.2026, nur lesend, pg_index und
-- pg_stat_user_indexes, Statistik seit 01.10.2026): Alle 24 sind B-Baeume
-- ohne Bedingung und ohne Ausdruck, keiner stuetzt UNIQUE, PRIMARY KEY oder
-- einen Constraint, und der laengere Partner hat dieselbe Operator-Klasse,
-- dieselbe Sortierung und dieselbe Collation in der ersten Spalte, ist selbst
-- weder partiell noch ein Ausdrucks-Index. Ein Teil wurde gelesen (etwa
-- idx_event_bookings_event_id 1,1 Mio. Zugriffe) -- weil der Planer bei
-- zwei gleich guten Indizes den kleineren nimmt; der Partner traegt
-- dieselbe Suche (idx_event_bookings_event_status 2,0 Mio. Zugriffe).
-- Zusammen 480 kB (20 x 16 kB, dazu 48, 40, 40 und 32 kB).
--
-- AUSGENOMMEN (bleiben):
--   - idx_bonus_points_organization_id, idx_events_organization_id,
--     idx_notifications_user_id: Ihr einziger laengerer Partner ist
--     partiell (idx_*_org_client_id nur mit client_id, idx_notifications_
--     unread nur ungelesene) und deckt nicht jede Zeile.
--   - idx_mail_nachrichten_vorgang_ungelesen: selbst partiell.
--
-- SPERRE: DROP INDEX nimmt kurz ACCESS EXCLUSIVE auf der Tabelle, liest und
-- schreibt aber keine Zeile (CONCURRENTLY geht in der Transaktion des
-- Migrationslaufs nicht und lohnt bei dieser Groesse nicht). Gemessen am
-- 10.10.2026 an einer Kopie der Produktion (lokal, drei Laeufe): 12 bis
-- 20 ms fuer die ganze Datei, ein zweiter Lauf 7 bis 8 ms.
--
-- SICHER GEGEN ABWEICHUNG: Ein Index faellt nur, wenn auf DIESER Datenbank
-- ein gueltiger, nicht partieller B-Baum mit derselben ersten Spalte (gleiche
-- Operator-Klasse, Collation, Sortierung) und mehr Spalten daneben steht und
-- er selbst kein Constraint stuetzt, nicht eindeutig, nicht partiell und kein
-- Ausdruck ist. Fehlt der Partner (Instanz mit abweichendem Schema), bleibt
-- der Index.
--
-- IDEMPOTENT: Was es nicht mehr gibt, wird uebergangen; ein zweiter Lauf
-- aendert nichts (tests/schema/migration210PraefixIndizes.test.js).

CREATE OR REPLACE FUNCTION pg_temp.praefix_indizes_entfernen()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  namen CONSTANT text[] := ARRAY[
    'idx_activity_categories_activity_id',
    'idx_certificate_types_organization_id',
    'idx_challenges_org',
    'idx_chat_reactions_message',
    'idx_chat_messages_room_id',
    'idx_chat_participants_room_id',
    'idx_chat_poll_votes_poll_id',
    'idx_event_bookings_event_id',
    'idx_event_bookings_user_id',
    'idx_event_categories_event_id',
    'idx_event_jahrgang_assignments_event_id',
    'idx_event_points_konfi_id',
    'idx_konfspruch_uebersetzungen_spruch',
    'idx_material_events_material_id',
    'idx_material_jahrgaenge_material_id',
    'idx_push_tokens_user_id',
    'idx_roles_organization_id',
    'idx_settings_organization_id',
    'idx_user_activities_user_id',
    'idx_user_badges_user_id',
    'idx_user_certificates_user_id',
    'idx_user_jahrgang_assignments_user_id',
    'idx_user_organizations_user',
    'idx_users_organization_id'
  ];
  n text;
BEGIN
  FOREACH n IN ARRAY namen LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_index a
        JOIN pg_class ac ON ac.oid = a.indexrelid
        JOIN pg_am aam ON aam.oid = ac.relam AND aam.amname = 'btree'
       WHERE ac.relname = n
         AND ac.relnamespace = 'public'::regnamespace
         AND a.indnatts = 1 AND a.indkey[0] <> 0
         AND NOT a.indisunique AND NOT a.indisprimary
         AND a.indpred IS NULL AND a.indexprs IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = a.indexrelid)
         AND EXISTS (
           SELECT 1
             FROM pg_index b
             JOIN pg_class bc ON bc.oid = b.indexrelid
             JOIN pg_am bam ON bam.oid = bc.relam AND bam.amname = 'btree'
            WHERE b.indrelid = a.indrelid
              AND b.indexrelid <> a.indexrelid
              AND b.indisvalid
              AND b.indnatts > 1
              AND b.indkey[0] = a.indkey[0]
              AND b.indclass[0] = a.indclass[0]
              AND b.indcollation[0] = a.indcollation[0]
              AND b.indoption[0] = a.indoption[0]
              AND b.indpred IS NULL AND b.indexprs IS NULL
         )
    ) THEN
      EXECUTE format('DROP INDEX public.%I', n);
    END IF;
  END LOOP;
END
$fn$;

SELECT pg_temp.praefix_indizes_entfernen();
