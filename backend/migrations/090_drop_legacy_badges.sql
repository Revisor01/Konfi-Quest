-- 090_drop_legacy_badges.sql
-- Altlast-Tabelle `badges` entfernen.
-- Verifiziert (09.06.2026): 0 Zeilen, 0 eingehende Foreign Keys, kein Code-Pfad
-- referenziert sie. Aktiver Badge-Pfad ist `custom_badges`
-- (user_badges.badge_id -> custom_badges). Siehe DB-Hygiene-Audit.
DROP TABLE IF EXISTS badges CASCADE;
