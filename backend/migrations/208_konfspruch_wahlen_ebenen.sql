-- 208: Konfisprueche je Kirchenkreis und Landeskirche (docs/messung/umami.md, S1)
--
-- Simon, 09.10.2026: Die Auswertung der Konfisprueche geht nach Gemeinde,
-- Kirchenkreis und Landeskirche, vollstaendig (auch eigene Sprueche im
-- Wortlaut), personenunabhaengig.
--
-- Je Wahl zusaetzlich Kirchenkreis und Landeskirche, wie die Gemeinde sie
-- zum Zeitpunkt der Wahl zugeordnet hatte (organizations.kirchenkreis_id ->
-- kirchenkreise.landeskirche_id, Migration 191). Geschrieben von
-- utils/konfspruch.js (spruchWahlMerken). So bleibt die Zahl auf diesen
-- Ebenen, wenn die Gemeinde geloescht wird oder spaeter einem anderen
-- Kirchenkreis zugeordnet ist.
--
-- WARUM KENNUNGEN UND NICHT NAMEN ALS TEXT: Kirchenkreise und Landeskirchen
-- werden in der Support-Ansicht umbenannt (Schreibweise korrigiert) -- mit
-- der Kennung folgt die Auswertung dem neuen Namen, mit Text zerfiele ein
-- Kirchenkreis in zwei Zeilen. Geloescht wird selten: eine Landeskirche nur
-- ohne Kirchenkreise (DELETE /support/landeskirchen/:id, 409 sonst), ein
-- Kirchenkreis etwa als Doppel. Dann setzt ON DELETE SET NULL nur diese
-- Ebene auf leer; die Landeskirche steht in einer eigenen Spalte und bleibt,
-- wenn ihr Kirchenkreis geht. Die Wahl selbst bleibt immer.
--
-- Fehlt einer Wahl Kirchenkreis und Landeskirche (die Gemeinde war beim
-- Waehlen noch nicht zugeordnet, oder ein Server-Stand vor 208 hat
-- geschrieben), ordnet die Auswertung sie der HEUTIGEN Zuordnung ihrer
-- Gemeinde zu (routes/metrikKonfisprueche.js).
--
-- BESTAND: Zeilen mit Gemeinde und ohne Kirchenkreis/Landeskirche bekommen
-- die heutige Zuordnung ihrer Gemeinde -- der Stand zur Zeit der Wahl ist
-- nicht bekannt.
--
-- ADDITIV: zwei neue Spalten ohne Pflichtwert; ein Server-Stand vor 208
-- schreibt weiter ohne sie.
-- IDEMPOTENT: ADD COLUMN/CREATE INDEX IF NOT EXISTS; der Nachtrag trifft nur
-- Zeilen, denen beide Spalten fehlen.

ALTER TABLE konfspruch_wahlen
  ADD COLUMN IF NOT EXISTS kirchenkreis_id BIGINT REFERENCES kirchenkreise(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landeskirche_id BIGINT REFERENCES landeskirchen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_konfspruch_wahlen_kirchenkreis ON konfspruch_wahlen (kirchenkreis_id);
CREATE INDEX IF NOT EXISTS idx_konfspruch_wahlen_landeskirche ON konfspruch_wahlen (landeskirche_id);

UPDATE konfspruch_wahlen w
   SET kirchenkreis_id = o.kirchenkreis_id,
       landeskirche_id = k.landeskirche_id
  FROM organizations o
  LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
 WHERE o.id = w.organization_id
   AND w.kirchenkreis_id IS NULL
   AND w.landeskirche_id IS NULL
   AND o.kirchenkreis_id IS NOT NULL;
