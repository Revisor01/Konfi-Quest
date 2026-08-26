-- konfi_profiles.invite_code_id: ON DELETE SET NULL statt NO ACTION.
--
-- Warum: Der Fremdschluessel hatte gar keine ON-DELETE-Regel (confdeltype 'a').
-- Dadurch blockierte er drei Loeschpfade mit einem 500er, sobald sich auch nur
-- EINE Person per Einladungscode registriert hatte -- am 26.08.2026 in
-- Produktion gemessen: 60 Profile mit invite_code_id.
--
--   1. Organisation loeschen: organizations.js loescht invite_codes VOR
--      konfi_profiles. Der FK haelt dagegen, die Transaktion bricht ab.
--   2. Admin/Teamer loeschen, deren Einladungscode benutzt wurde -- auch die
--      Selbstloeschung des eigenen Kontos. Letzteres verlangt Apple im
--      Store-Review ausdruecklich, es MUSS funktionieren.
--   3. DELETE /auth/invite-codes/:id auf einen bereits benutzten Code.
--
-- SET NULL statt CASCADE: Der Einladungscode ist Herkunftsinformation, kein
-- Bestandteil des Profils. Faellt der Code weg, soll das Profil bleiben --
-- CASCADE wuerde Konfis loeschen, nur weil ein Code aufgeraeumt wurde.
--
-- Dieselbe Fehlerklasse wie die im August reparierten user_certificates-Faelle.

ALTER TABLE konfi_profiles
  DROP CONSTRAINT IF EXISTS konfi_profiles_invite_code_id_fkey;

ALTER TABLE konfi_profiles
  ADD CONSTRAINT konfi_profiles_invite_code_id_fkey
  FOREIGN KEY (invite_code_id) REFERENCES invite_codes(id)
  ON DELETE SET NULL;
