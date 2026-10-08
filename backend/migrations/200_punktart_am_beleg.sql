-- 200: Punktart am Beleg (offene Befunde, Punkte/Termine BF-02, Rest;
-- 08.10.2026).
--
-- Seit Migration 163 traegt jede Zuordnung einer Aktivitaet (user_activities)
-- den Punktwert der Vergabe, die Art (gottesdienst/gemeinde) aber nicht.
-- Aenderte die Leitung die Art einer Aktivitaet, lasen Ruecknahme,
-- Detailliste und Historie die NEUE Art: Die Ruecknahme zog von der Saeule ab,
-- auf die nie gebucht wurde, Liste und Historie zeigten die Punkte in der
-- anderen Saeule.
--
-- user_activities.type haelt die Art zum Zeitpunkt der Vergabe fest. Die drei
-- Vergabewege (Konfi-Verwaltung, assign-activity, Antrag genehmigen) schreiben
-- sie; Leser nehmen COALESCE(ua.type, a.type).
--
-- BESTAND: wird mit der heutigen Art der Aktivitaet gefuellt. Das ist genau
-- die Art, die die Leser bis heute zeigen -- es aendert sich also nichts an
-- dem, was jemand sieht; nur kuenftige Aenderungen der Art schlagen nicht mehr
-- auf alte Belege durch. Wo die Art schon frueher geaendert wurde, ist die
-- urspruengliche Art nicht mehr rekonstruierbar.
--
-- ADDITIV: neue Spalte ohne Vorgabe, NULL erlaubt (Teamer-Aktivitaeten haben
-- keine Art). Antworten mit ua.* bzw. ka.* bekommen ein Feld mehr; wo bisher
-- a.type als `type` in der Antwort stand, steht derselbe Name mit demselben
-- Typ. Alte Server-Staende lesen die Spalte nicht.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS; das Fuellen trifft nur Zeilen ohne Art.

ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS type TEXT;

UPDATE user_activities ua
   SET type = a.type
  FROM activities a
 WHERE a.id = ua.activity_id
   AND ua.type IS NULL
   AND a.type IS NOT NULL;
