-- Direktchats mit mehr als zwei Personen werden Gruppen (26.09.2026)
--
-- BEFUND (Audit 26.09.2026, Chat BF-01, HOCH): POST /chat/rooms nahm den
-- Typ 'direct' mit beliebig vielen Teilnehmenden an, sobald der Aufrufer
-- kein Konfi war. Ein Raum vom Typ 'direct' gilt ueberall als
-- Zweiergespraech -- die Leitung darf ihn weder lesen noch exportieren noch
-- darin loeschen (darfRaumOeffnen in routes/chat.js). Wer zwei Konfis in
-- einen solchen Raum setzte, schuf damit genau den Konfi-zu-Konfi-Chat ohne
-- Aufsicht, den es laut Regel nicht gibt. Die Route weist das seit dem
-- 26.09.2026 mit 400 ab; hier der Bestand.
--
-- NUR RAEUME MIT MEHR ALS ZWEI PERSONEN. Ein 'direct'-Raum mit nur noch
-- einer Person (die andere hat ihr Konto geloescht) bleibt ein privates
-- Zweiergespraech und wird NICHT fuer die Leitung geoeffnet.
--
-- ADDITIV: nur ein Typwechsel. Keine Nachricht, keine Teilnehmerin, keine
-- Datei geht verloren; die Store-Apps kennen 'group' seit jeher.
UPDATE chat_rooms r
   SET type = 'group'
 WHERE r.type = 'direct'
   AND (SELECT COUNT(*) FROM chat_participants p WHERE p.room_id = r.id) > 2;
