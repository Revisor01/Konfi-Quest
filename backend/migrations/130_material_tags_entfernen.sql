-- 130_material_tags_entfernen.sql
--
-- Material-Tags werden entfernt (Simons Entscheidung 27.08.2026).
--
-- Befund 13 aus dem Rollen-Bericht (26.08.2026): Das Backend bot ein
-- vollstaendiges CRUD (GET/POST/PUT/DELETE /material/tags), eine
-- Zuordnungstabelle und eine Filterung nach tag_id -- aber es gab keine
-- Zeile Oberflaeche dafuer und kein Wort im Handbuch. Eine unfertig
-- gebliebene Funktion.
--
-- Vor dem Entfernen in Produktion nachgemessen (27.08.2026):
--   material_tags:       1 Zeile ("Spiele", Organisation 1)
--   material_file_tags:  0 Zeilen
-- Also ein Test-Ueberbleibsel ohne jede Zuordnung -- es geht nichts
-- verloren, was jemand angelegt und benutzt haette.
--
-- Zuerst die Join-Tabelle, dann die Haupttabelle (Fremdschluessel-Reihenfolge).
DROP TABLE IF EXISTS material_file_tags;
DROP TABLE IF EXISTS material_tags;
