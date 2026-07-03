-- Audit 03.07.2026 (Achse 1, F5/F6): SQLite-Altlast — mehrere Spalten trugen
-- ZWEI FK-Constraints. Die hier gedroppten sind nachweislich funktionslos:
-- - bonus_points.organization_id + user_activities.activity_id: je NO ACTION
--   UND CASCADE parallel; Postgres wendet die STRIKTESTE Regel an, NO ACTION
--   gewinnt heute schon -> der CASCADE-Zwilling ist ein No-op und das Schema
--   suggeriert faelschlich Cascade-Verhalten.
-- - event_bookings/event_points: je zwei IDENTISCHE CASCADE-FKs.
-- WICHTIG: Die vier GEWOLLTEN NO-ACTION+CASCADE-Paare auf users(id)
-- (activity_requests, bonus_points.konfi_id, user_activities.user_id,
-- user_badges.user_id) bleiben unangetastet — sie schuetzen die Konfi-History
-- beim Jahrgang-Delete (User-Delete-Handler raeumt explizit).

ALTER TABLE bonus_points    DROP CONSTRAINT IF EXISTS fk_bonus_points_org;
ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS fk_user_activities_activity;
ALTER TABLE event_bookings  DROP CONSTRAINT IF EXISTS fk_event_bookings_event;
ALTER TABLE event_bookings  DROP CONSTRAINT IF EXISTS fk_event_bookings_user;
ALTER TABLE event_points    DROP CONSTRAINT IF EXISTS fk_event_points_event;
ALTER TABLE event_points    DROP CONSTRAINT IF EXISTS fk_event_points_konfi;
