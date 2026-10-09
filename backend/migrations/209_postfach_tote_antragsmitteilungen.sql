-- Postfach: Zustands-Mitteilungen zu geloeschten Antraegen entfernen
-- (09.10.2026)
--
-- BEFUND (Bestandszaehlung 09.10.2026, Produktion lesend): 51 Mitteilungen
-- "Neuer Antrag" (bei der Leitung) und "Antrag eingereicht" (bei der Person
-- selbst) zeigen auf Antraege, die es nicht mehr gibt -- 33 davon ungelesen,
-- bei 21 Personen, die aelteste vom 29.06.2026, die juengste vom 25.09.2026.
-- Sie stammen aus der Zeit, bevor das Loeschen eines Antrags das Postfach
-- mitaufraeumte (utils/postfachAufraeumen.js, loescheMitteilungenZuAntraegen,
-- seit dem 25.09.2026). Die ungelesenen zaehlen in die rote Zahl, und das
-- Antippen fuehrt in eine Liste, in der der Antrag fehlt.
--
-- DIESELBE REGEL WIE BEIM LOESCHEN HEUTE: nur die Arten, die einen ZUSTAND
-- des Antrags melden (ZUSTANDS_ARTEN_ANTRAG), Zuordnung ueber
-- data->>'request_id', als Text verglichen und nie gecastet. Ein Test haelt
-- die Liste gleich: tests/utils/migration209ToteAntragsmitteilungen.test.js.
--
-- WAS BLEIBT:
--   - die Entscheidungen (activity_request_decision, "genehmigt/abgelehnt"):
--     Verlauf, wie beim Loeschen heute;
--   - jede Zustands-Mitteilung, deren Antrag es noch gibt;
--   - Zeilen ohne request_id (data NULL, leer, blosser JSON-String): nicht
--     geraten, wie in loescheMitteilungenZuAntraegen. Gemessen 09.10.2026:
--     0 solche Zeilen.
--
-- SPERRE: DELETE mit Zeilensperren, kein Tabellen-Lock. Die Tabelle ist
-- klein (Postfach mit 365-Tage-Frist; 1.443 Zeilen dieser zwei Arten).
--
-- IDEMPOTENT: Ein zweiter Lauf findet nichts mehr; seit dem 25.09.2026
-- nehmen alle Loeschstellen eines Antrags seine Mitteilungen mit.

DELETE FROM notifications n
 WHERE n.type IN (
         'new_activity_request',
         'activity_request_submitted'
       )
   AND COALESCE(n.data->>'request_id', '') <> ''
   AND NOT EXISTS (
         SELECT 1 FROM activity_requests r
          WHERE r.id::text = n.data->>'request_id'
       );
