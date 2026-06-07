-- Migration 086: Kirchenkreis pro Organisation (optionales Freitextfeld)
-- Fuegt die nullbare Spalte organizations.kirchenkreis hinzu.
--   kirchenkreis IS NULL / ''  = nicht angegeben (optional).
--   kirchenkreis = <text>      = Name des Kirchenkreises (z.B. "Kirchenkreis Dithmarschen").
-- Kein Backfill, kein DEFAULT: bestehende und neue Orgs starten ohne Wert.
-- Wird von org_admin/super_admin ueber die normale Org-PUT-Route gepflegt.
-- Idempotent (IF NOT EXISTS), wird vom Migration-Runner (backend/database.js) ausgefuehrt.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kirchenkreis TEXT NULL;
