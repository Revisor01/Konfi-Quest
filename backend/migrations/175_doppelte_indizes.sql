-- Exakt doppelte Indizes entfernen (29.09.2026)
--
-- BEFUND (Audit 26.09.2026, Datenbank BF-09): Neun Indizes hatten einen
-- Zwilling mit genau derselben Definition (Tabelle, Spalten, Reihenfolge,
-- Praedikat, Methode) -- Reste der SQLite-Uebernahme (sqlite_autoindex_*)
-- und alte Handanlagen neben den Indizes aus 064/097/110/124. Jede Zeile
-- wurde in beide geschrieben; Sicherung und Autovacuum arbeiteten doppelt.
-- settings raeumt Migration 174 ab, hier die uebrigen acht.
--
-- BEHALTEN wird jeweils der Index, an dem ein Constraint haengt oder der die
-- Eindeutigkeit traegt; sind beide gleichrangig, der aus der
-- Migrationskette benannte. KEIN CONSTRAINT HAENGT an einem der entfernten
-- (geprueft: pg_constraint.conindid, auch fuer Fremdschluessel anderer
-- Tabellen). Haengte einer daran, scheiterte DROP INDEX und die ganze Datei
-- rollte zurueck -- still verlorene Eindeutigkeit gibt es so nicht.
--
--   entfernt                                          bleibt
--   idx_25001_sqlite_autoindex_activity_categories_1  uq_activity_categories_activity_category (110, UNIQUE)
--   idx_chat_poll_votes_poll                          idx_chat_poll_votes_poll_id (064)
--   idx_chat_polls_message                            idx_chat_polls_message_id (064)
--   idx_daily_verses_date_translation (124)           daily_verses_date_translation_key (UNIQUE-Constraint)
--   idx_konfi_profiles_user_id (064)                  idx_25109_sqlite_autoindex_konfi_profiles_1 (UNIQUE)
--   idx_levels_organization_points                    levels_organization_id_points_required_key (UNIQUE-Constraint)
--   idx_notifications_user                            idx_notifications_user_id (064)
--   idx_password_resets_token (064)                   idx_25067_sqlite_autoindex_password_resets_1 (UNIQUE)
--
-- Die 33 Indizes, die nur als fuehrende Spalte eines anderen vorkommen
-- (etwa idx_chat_messages_room_id neben idx_chat_messages_room_created),
-- bleiben: Ein Einzelspalten-Index ist kleiner und kann dem Planer lieber
-- sein. Ueber sie entscheidet die Zahl der Zugriffe in der Produktion
-- (pg_stat_user_indexes.idx_scan, Auftrag 11).
--
-- SPERRE: DROP INDEX liest keine Zeile, braucht aber kurz ACCESS EXCLUSIVE auf
-- der Tabelle (der Migrationslauf gibt nach lock_timeout 10 s auf und
-- versucht es beim naechsten Start). Lastbestand (20.000 Konten, 16.000
-- Profile): 7-50 ms in sechs von sieben Laeufen, einmal 2,8 s unter fremder
-- Plattenlast auf dem Messrechner. Frei werden dort 464 kB, fast alles
-- idx_konfi_profiles_user_id (368 kB).
--
-- IDEMPOTENT: DROP INDEX IF EXISTS.

DROP INDEX IF EXISTS idx_25001_sqlite_autoindex_activity_categories_1;
DROP INDEX IF EXISTS idx_chat_poll_votes_poll;
DROP INDEX IF EXISTS idx_chat_polls_message;
DROP INDEX IF EXISTS idx_daily_verses_date_translation;
DROP INDEX IF EXISTS idx_konfi_profiles_user_id;
DROP INDEX IF EXISTS idx_levels_organization_points;
DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_password_resets_token;
