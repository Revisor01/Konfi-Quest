-- Migration 087: 30-Tage-Testphase pro Organisation
-- Fuegt die nullbare Spalte organizations.trial_ends_at hinzu.
--   trial_ends_at IS NULL        = kein Trial / bezahlt (unbegrenzt nutzbar).
--   trial_ends_at = <timestamp>  = Testphase laeuft bis zu diesem Zeitpunkt.
-- Bei Ablauf setzt ein taeglicher Cron die Org auf is_active = false (Sperre).
-- Login + Refresh pruefen trial_ends_at zusaetzlich direkt (sofortige Sperre,
-- auch falls der Cron noch nicht gelaufen ist).
--
-- WICHTIG kein Backfill fuer BESTEHENDE Orgs: alle aktuell vorhandenen Orgs
-- bleiben auf NULL (= bezahlt/unbegrenzt), damit keine produktive Gemeinde
-- durch die Migration ploetzlich in einen abgelaufenen Trial faellt.
-- NUR neu erstellte Orgs bekommen ab jetzt im Backend trial_ends_at = now()+30d.
-- Idempotent (IF NOT EXISTS), Migration-Runner backend/database.js.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP NULL;
