-- 150_absagegrund.sql
--
-- EIN TERMIN WIRD ABGESAGT -- UND NIEMAND ERFAEHRT, WARUM.
--
-- Simons Fall (15.09.2026): Die Konfifreizeit faellt aus, weil die Heizung im
-- Gemeindehaus kaputt ist. Angemeldet sind zwanzig Konfis. Sie bekommen einen
-- Push ("Leider abgesagt: ...") und sehen in der App "Abgesagt" -- mehr nicht.
-- Die Rueckfragen landen danach alle einzeln im Chat und am Telefon. Der
-- Grund steht heute nirgends, obwohl die Leitung ihn beim Absagen im Kopf
-- hat.
--
-- Die Route PUT /events/:id/cancel nimmt zwar seit jeher ein Feld
-- notification_message entgegen -- aber sie gibt es nur in der Antwort
-- zurueck. Gespeichert wird es nicht, im Push steht es auch nicht. Es ist
-- also kein Absagegrund, sondern ein Echo. Deshalb eine eigene Spalte statt
-- einer Umdeutung des Bestehenden: notification_message bleibt, was es ist
-- (ausgelieferte App-Fassungen schicken es mit), und der Grund bekommt einen
-- eigenen Platz mit einer eigenen Bedeutung.
--
-- ZWEI SPALTEN, beide NULLABLE, beide additiv:
--
--   cancelled_reason  -- warum abgesagt wurde ("Heizung im Gemeindehaus defekt")
--   cancelled_by      -- wer abgesagt hat
--
-- (cancelled_at gibt es bereits und wird von der Route schon gesetzt.)
--
-- DER GRUND IST FREIWILLIG (Entscheidung Simon, 15.09.2026): Ein Pflichtfeld
-- wuerde die Absage aufhalten, und eine Absage ist oft eilig -- morgens um
-- sieben, wenn feststeht, dass es nicht geht. Ohne Grund verhaelt sich alles
-- wie bisher: derselbe Push-Text, keine zusaetzliche Zeile in der App. NULL
-- heisst hier "kein Grund angegeben", nicht "unbekannt".
--
-- DER GRUND IST FUER ALLE SICHTBAR (Entscheidung Simon, 15.09.2026): Nicht
-- nur fuer die Leitung. Er wird an alle Teilnehmenden ausgeliefert und im
-- Push mitgeschickt -- das ist sein ganzer Zweck. Wer ihn schreibt, weiss
-- also, dass die Konfis ihn lesen.
--
-- cancelled_by NACH DEM MUSTER VON MIGRATION 148/149
-- (attendance_set_by, note_set_by): INTEGER auf users(id) mit
-- ON DELETE SET NULL. Wird die absagende Person geloescht, bleibt die Absage
-- stehen -- nur die Zuordnung entfaellt. Und wie dort gilt: NULL heisst
-- UNBEKANNT, nicht NIEMAND. Jeder Termin, der vor dieser Migration abgesagt
-- wurde, traegt cancelled = TRUE ohne Urheber; die Information existiert
-- schlicht nicht. Die Anzeige laesst die Zeile deshalb weg, statt
-- "Abgesagt von unbekannt" zu behaupten. KEIN Backfill -- geraten waere
-- schlechter als nichts.
--
-- KEIN EIGENES PAAR FUER DEN GRUND (wie in Migration 149 diskutiert): Der
-- Grund gehoert zur Absage, und die Absage passiert genau einmal --
-- cancelled ist nicht zurueckzunehmen, also kann auch niemand spaeter nur
-- den Grund aendern. Ein Termin, ein Absagevorgang, ein Urheber.
--
-- ALT-APP-VERTRAG: rein additiv. Keine Spalte entfaellt, keine aendert Typ
-- oder Bedeutung, keine Bestandszeile wird umgeschrieben. Ausgelieferte
-- App-Fassungen sehen zwei Felder mehr am Termin und ignorieren sie; der
-- Push-Text bleibt ohne Grund Zeichen fuer Zeichen derselbe.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'events_cancelled_by_fkey'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_cancelled_by_fkey
      FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN events.cancelled_reason IS
  'Freiwilliger Grund der Absage, sichtbar fuer ALLE Teilnehmenden und im Push. NULL = kein Grund angegeben (Normalfall). NICHT zu verwechseln mit notification_message, das die Route nur in der Antwort zurueckgibt und nie gespeichert hat.';

COMMENT ON COLUMN events.cancelled_by IS
  'Wer den Termin abgesagt hat. NULL = unbekannt: Termine, die vor Migration 150 abgesagt wurden. Kein Backfill.';
