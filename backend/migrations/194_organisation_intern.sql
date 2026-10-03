-- 194: Interne Gemeinden (Simon, 03.10.2026; docs/planung/support-web.md,
-- Entscheidung 5).
--
-- Die Review- und Test-Gemeinden fuer die Stores (Test Teamer Sicht, Test
-- Konfi Sicht, Admin Review Sicht) gehoeren dem Betrieb, nicht einer
-- Kundengemeinde. Mit organizations.intern = true erscheinen sie in keiner
-- Liste und keiner Zahl der Support-Ansicht und nicht in
-- GET /api/organizations; Zugriffe ueber die Kennung (GET und PUT
-- /api/organizations/:id) bleiben moeglich. Gesetzt wird die Spalte nur
-- direkt in der Datenbank, es gibt keinen Schalter in der Oberflaeche.
--
-- ADDITIV: eine neue Spalte mit Vorgabe false -- jede vorhandene Gemeinde
-- bleibt sichtbar, ein alter Server-Stand und alte Apps lesen die Spalte nicht
-- (GET /api/organizations und /:id liefern mit organizations.* ein Feld mehr).
-- Ab PostgreSQL 11 legt ADD COLUMN mit konstanter Vorgabe die Zeilen nicht neu
-- an; die Sperre (ACCESS EXCLUSIVE auf organizations) dauert Millisekunden.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; ein zweiter Lauf aendert nichts und
-- ueberschreibt keinen gesetzten Wert.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS intern BOOLEAN NOT NULL DEFAULT false;
