-- 204: „Darf freigeben" und die Kennzahlen-Wahl der Leitung
-- (docs/planung/darf-freigeben.md, Entscheidungen Simon 09.10.2026).
--
-- 1. Drei Rechte je Jahrgangs-Zuweisung, einzeln festlegbar, wie can_edit:
--      darf_antraege_entscheiden   Antraege genehmigen, ablehnen, zuruecksetzen
--      darf_events_verbuchen       Anwesenheit an Terminen eintragen
--      darf_challenges_freigeben   Challenge-Beitraege moderieren
--    Vorgabe true: Alle bestehenden Zuweisungen behalten alle drei Rechte,
--    niemand bekommt nach dem Deploy weniger. Die Org-Leitung hat sie immer;
--    die Spalten wirken fuer die Rolle admin (utils/freigabeRechte.js).
--
-- 2. leitung_kennzahlen: welche Zahlen eine Leitungsperson in EINER Gemeinde
--    sehen will (Rolle und Jahrgaenge gelten je Gemeinde). Keine Zeile heisst
--    "alles an" -- wie bisher. Aus heisst: keine Zahl am Reiter, nichts in der
--    Zahl am App-Symbol, kein Push dafuer (utils/leitungKennzahlen.js).
--
-- ADDITIV: neue Spalten mit Vorgabe, neue Tabelle. Store-Apps 2.2.x/2.3.x
-- kennen die Felder nicht; sie schicken sie nicht mit, und der Server
-- uebernimmt dann den bisherigen Wert (routes/users.js, POST /:id/jahrgaenge).
--
-- IDEMPOTENT: IF NOT EXISTS.

ALTER TABLE user_jahrgang_assignments
  ADD COLUMN IF NOT EXISTS darf_antraege_entscheiden BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS darf_events_verbuchen BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS darf_challenges_freigeben BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS leitung_kennzahlen (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  antraege BOOLEAN NOT NULL DEFAULT true,
  verbuchen BOOLEAN NOT NULL DEFAULT true,
  challenges BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, organization_id)
);

-- Der Schluessel deckt die Suche je Person; geloescht wird auch je Gemeinde
-- (ON DELETE CASCADE von organizations).
CREATE INDEX IF NOT EXISTS idx_leitung_kennzahlen_organization
  ON leitung_kennzahlen (organization_id);
