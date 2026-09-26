-- 163: Punktwert am Zuordnungsdatensatz speichern
--
-- Audit 26.09.2026 (Punkte/Termine BF-02, HOCH): user_activities speicherte
-- nur die Zuordnung Konfi <-> Aktivität, nicht den gutgeschriebenen Wert.
-- Gutgeschrieben wurde activities.points zum Zeitpunkt der Vergabe; angezeigt
-- (Punktehistorie, Detailansicht) und zurückgenommen (Löschen der Zuordnung,
-- Antrags-Reset) wurde der AKTUELLE Wert der Aktivität. Änderte die Leitung
-- den Punktwert (1 -> 5), zeigte die Historie 5, obwohl 1 gutgeschrieben war,
-- und eine Rücknahme zog 5 ab — der Saldo war nicht mehr rekonstruierbar.
-- bonus_points und event_points tragen ihren Wert längst am Beleg;
-- user_activities zieht hier nach.
--
-- ADDITIV: eine neue, nullbare Spalte. Keine bestehende Spalte ändert Form
-- oder Typ, keine Antwortform ändert sich (die Lesestellen liefern weiter das
-- Feld `points`, nur aus COALESCE(ua.points, a.points)). Name und Typ wie bei
-- den Nachbarn bonus_points.points und event_points.points (bigint).
--
-- KEIN DB-Default: Der Wert kommt aus der Aktivität zum Zeitpunkt der Vergabe
-- bzw. aus dem genehmigten Antrag (routes/activities.js,
-- routes/konfi-management.js) — das Schema kennt ihn nicht.
--
-- BACKFILL in EINER Anweisung: Der Bestand bekommt den heutigen Wert seiner
-- Aktivität. Das ist genau der Wert, den Historie und Detailansicht heute
-- anzeigen und den eine Rücknahme heute abzieht — also verlustfrei. Häppchen
-- brächten nichts: Der Läufer (database.js) führt jede Datei in EINER
-- Transaktion aus, die Sperren blieben bis zum COMMIT ohnehin bestehen.
-- Der Pool setzt statement_timeout und query_timeout auf 30 s (database.js);
-- query_timeout gilt clientseitig für die GANZE Datei, ein SET LOCAL hülfe
-- also nicht. Das UPDATE muss deutlich darunter bleiben. Gemessen am
-- 26.09.2026 auf einer Kopie einer Messdatenbank (PostgreSQL 16, 20.000
-- Nutzer:innen, 200 Gemeinden, geteilte Maschine) mit synthetischen
-- Zuordnungen, je zwei Läufe:
--   500.000 Zeilen  ( 65 MB): ALTER 0,8 ms, UPDATE 10,0 s / 7,3 s
--   1.000.000 Zeilen (140 MB): ALTER 1,1 ms, UPDATE 12,6 s / 12,8 s
-- Reicht bis gut 2 Millionen Zuordnungen. Vor dem Deploy in Produktion
-- SELECT count(*) FROM user_activities ansehen; liegt der Bestand darüber,
-- den Backfill in Häppchen aus einem Hintergrundjob fahren statt hier.
--
-- Zeilen, die danach noch NULL tragen (Aktivität ohne Punktwert, etwa alte
-- Teamer-Aktivitäten), verhalten sich über COALESCE weiter wie heute.

ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS points bigint;

UPDATE user_activities ua
   SET points = a.points
  FROM activities a
 WHERE a.id = ua.activity_id
   AND ua.points IS NULL;

COMMENT ON COLUMN user_activities.points IS
  'Bei der Vergabe gutgeschriebener Punktwert (Wert der Aktivität zu diesem Zeitpunkt, Migration 163). NULL nur bei Bestand ohne Aktivitätswert; Lesestellen fallen dann auf activities.points zurück. Eine spätere Änderung der Aktivität ändert diesen Wert nicht.';
