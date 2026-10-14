-- 214: Eine verbuchte Aktivität kennt ihren Antrag (13.10.2026)
--
-- Simon, Seiten-Interview 13.10.2026 (Detailseite einer Konfi): „klick auf
-- eine aktivität sollte den antrag öffnen". Bis hierher legte die Genehmigung
-- (PUT /api/admin/activities/requests/:id) eine Zeile in user_activities an,
-- ohne zu vermerken, aus welchem Antrag sie stammt -- die Detailseite konnte
-- von der Aktivität nicht zur Meldung der Konfi (Datum, Kommentar, Foto,
-- Entscheidung) finden. Auch das Zurücksetzen eines Antrags musste die Zeile
-- raten (die jüngste zu Person und Aktivität).
--
--   request_id   der Antrag, aus dem die Zeile entstand; NULL bei allem, was
--                die Leitung selbst einträgt (assign-activity, Konfi-
--                Verwaltung) und beim Altbestand ohne eindeutigen Antrag.
--                ON DELETE SET NULL: Abgelehnte Anträge lassen sich löschen,
--                die Aktivität bleibt.
--
-- ALTBESTAND: Zugeordnet wird nur, was eindeutig ist -- GENAU EIN genehmigter
-- Antrag zu Person, Aktivität und Datum (requested_date = completed_date, so
-- schreibt die Genehmigung) UND genau eine Zeile in user_activities dazu.
-- Zwei gleiche Meldungen am selben Tag oder eine zusätzliche Eintragung der
-- Leitung am selben Tag bleiben ohne Zuordnung: lieber kein Link als ein
-- falscher.
--
-- ADDITIV: neue, nullbare Spalte; die Detailantwort GET /api/admin/konfis/:id
-- liefert sie über ka.* als activities[].request_id mit. Store-Apps lesen das
-- Feld nicht. IDEMPOTENT: ADD COLUMN / CREATE INDEX IF NOT EXISTS; die
-- Zuordnung fasst nur Zeilen ohne request_id und Anträge ohne Zeile an.

ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES activity_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_activities_request_id ON user_activities (request_id);

WITH eindeutig AS (
  SELECT MIN(ar.id) AS request_id, ar.user_id, ar.activity_id, ar.requested_date
    FROM activity_requests ar
   WHERE ar.status = 'approved'
     AND ar.requested_date IS NOT NULL
   GROUP BY ar.user_id, ar.activity_id, ar.requested_date
  HAVING COUNT(*) = 1
),
zeilen AS (
  SELECT MIN(ua.id) AS ua_id, ua.user_id, ua.activity_id, ua.completed_date
    FROM user_activities ua
   GROUP BY ua.user_id, ua.activity_id, ua.completed_date
  HAVING COUNT(*) = 1
)
UPDATE user_activities ua
   SET request_id = e.request_id
  FROM eindeutig e
  JOIN zeilen z
    ON z.user_id = e.user_id
   AND z.activity_id = e.activity_id
   AND z.completed_date = e.requested_date
 WHERE ua.id = z.ua_id
   AND ua.request_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM user_activities schon WHERE schon.request_id = e.request_id);
