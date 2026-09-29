-- 172_konfi_historie_anlass_abzeichen.sql
--
-- DIE KOPIE DER KONFI-ZEIT ENTSTEHT AUCH VOR DEM LOESCHEN ODER AENDERN EINES
-- BADGES (28.09.2026).
--
-- Simon, 28.09.2026: "Geloeschte Badges muessen bei befoerdertem erhalten
-- bleiben. Auch wenn wir die zb aendern. Weil weniger Punkte als Ziel oder
-- so."
--
-- DELETE /badges/:id nimmt alle verliehenen Exemplare aus user_badges mit,
-- PUT /badges/:id aendert Name, Kriterium und Zielwert rueckwirkend fuer
-- alle, die es tragen. Fuer Befoerderte zeigt die App die Konfi-Badges
-- seither aus der Kopie in konfi_historie (Migration 170,
-- utils/konfiHistorie.js). Wer vor dem 28.09.2026 befoerdert wurde und noch
-- keine Kopie hat, bekommt sie im selben Zug -- VOR dem Loeschen bzw.
-- Aendern. Dafuer braucht die Spalte anlass zwei weitere Werte.
--
-- ALT-APP-VERTRAG: rein additiv. Der CHECK wird nur erweitert; die
-- bisherigen Werte bleiben gueltig, keine Zeile aendert sich. Die Kopie liest
-- keine ausgelieferte App (GET /teamer/konfi-zeit kam nach 2.3.0-Tag).

ALTER TABLE konfi_historie DROP CONSTRAINT IF EXISTS konfi_historie_anlass_check;

ALTER TABLE konfi_historie
  ADD CONSTRAINT konfi_historie_anlass_check
  CHECK (anlass IN ('befoerderung', 'jahrgang_geloescht', 'abzeichen_geloescht', 'abzeichen_geaendert'));
