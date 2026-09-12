-- 147_anwesenheit_abgemeldet_und_vermerk.sql
--
-- ANWESENHEIT KENNT NUR ANWESEND ODER ABWESEND -- DAS TRIFFT DIE WIRKLICHKEIT
-- NICHT.
--
-- Simons Fall (12.09.2026): Eine Mutter meldet ihre Tochter wegen Krankheit
-- ab -- per Telefon, nicht in der App. In der Anwesenheitsliste bleibt nur
-- die Wahl zwischen "anwesend" (falsch) und "abwesend" (richtig, aber es
-- sieht aus wie unentschuldigtes Fehlen). Der Grund und der Unterschied
-- gehen verloren, und die Kolleginnen sehen nicht, dass abgemeldet wurde.
--
-- Zweiter Fall: Eine Konfirmandin bittet darum, schon um 14 Uhr zu gehen.
-- Sie war da, bekommt ihre Punkte, ist also ANWESEND -- aber der Vermerk
-- soll trotzdem festgehalten werden koennen.
--
-- Drei Felder, alle NULLABLE, alle additiv:
--
--   attendance_status bekommt zusaetzlich 'excused' (abgemeldet)
--   excuse_reason     -- warum abgemeldet wurde ("krank, Mutter hat angerufen")
--   attendance_note   -- Vermerk unabhaengig vom Status ("ging um 14 Uhr")
--
-- WARUM NICHT opt_out_reason MITBENUTZEN, das es schon gibt:
-- opt_out_reason gehoert zu status='opted_out' -- der SELBSTabmeldung einer
-- Konfi von einem Pflichttermin (routes/konfi.js:1729, nur vor dem Termin
-- moeglich). Das ist ein anderer Vorgang, von einer anderen Person, zu einer
-- anderen Zeit: Hier traegt die LEITUNG nach, was ausserhalb der App gemeldet
-- wurde, oft erst beim Verbuchen NACH dem Termin. Beides in ein Feld zu legen
-- hiesse, zwei Vorgaenge nicht mehr auseinanderhalten zu koennen -- und die
-- Matrix unterscheidet sie bereits (getZellStatus: 'opted_out' vor
-- attendance_status).
--
-- WARUM ZWEI FELDER STATT EINEM (Entscheidung Simon, 12.09.2026):
-- Ein gemeinsames "Vermerk"-Feld waere weniger Arbeit, haette aber je nach
-- Status eine andere Bedeutung. Getrennt bleibt lesbar, was gemeint ist --
-- und beide koennen nebeneinander stehen: abgemeldet MIT Grund, und beim
-- naechsten Termin anwesend MIT Vermerk.
--
-- PUNKTE: 'excused' verhaelt sich wie 'absent' -- keine Punkte, bereits
-- vergebene werden abgezogen (Entscheidung Simon: "zaehlt wie ne Abmeldung").
-- Der Unterschied liegt allein in der Dokumentation, nicht in der Bewertung.
--
-- KEIN CHECK-CONSTRAINT auf attendance_status: Die Spalte hat heute keinen,
-- und einer waere eine Verschaerfung gegen ausgelieferte App-Fassungen --
-- die schreiben weiterhin nur 'present'/'absent', das bleibt gueltig. Die
-- erlaubten Werte prueft die Route (events/anwesenheit.js).

ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS excuse_reason text;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS attendance_note text;

COMMENT ON COLUMN event_bookings.excuse_reason IS
  'Grund einer von der Leitung nachgetragenen Abmeldung (attendance_status = ''excused''). NICHT zu verwechseln mit opt_out_reason -- das ist die Selbstabmeldung der Konfi vor dem Termin.';

COMMENT ON COLUMN event_bookings.attendance_note IS
  'Freier Vermerk zur Anwesenheit, unabhaengig vom Status. Beispiel: "ging um 14 Uhr". Sichtbar fuer Leitung und Team.';
