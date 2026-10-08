-- 202: Dauerhafte Warteschlange fuer die Arbeit nach der Antwort
-- (Befund "Mitteilungen nach der Antwort gehen bei einem Neustart verloren",
-- docs/offene-befunde.md).
--
-- Viele Routen antworten zuerst und schicken danach Push, Postfach-Eintrag
-- oder E-Mail (utils/nachAntwort.js). Bis hierher lief diese Arbeit nur im
-- Speicher des Prozesses: Startete der Container in der Zeit danach neu
-- (Deploy, Absturz), fehlten die Mitteilungen, obwohl die Aenderung selbst
-- (Punkte, Abzeichen, Buchung) gespeichert war.
--
-- Jetzt legt die Route einen Auftrag in diese Tabelle (eine Zeile je
-- Auftrag: Art und Parameter als JSON) und stoesst ihn sofort im eigenen
-- Prozess an. Ein Arbeiter auf jeder Replica holt liegengebliebene Auftraege
-- nach (utils/warteschlange.js):
--   - status 'offen'   -> wartet (ab faellig_ab)
--   - status 'laeuft'  -> von gesperrt_von bis gesperrt_bis angenommen; ist
--                         gesperrt_bis vorbei (Prozess weg), holt ihn eine
--                         andere Replica wieder ab
--   - status 'erledigt' / 'fehlgeschlagen' -> fertig; der Arbeiter raeumt sie
--                         nach 7 bzw. 30 Tagen weg
-- Das Annehmen geschieht mit FOR UPDATE SKIP LOCKED: Zwei Replicas nehmen
-- denselben Auftrag nie gleichzeitig an.
--
-- erledigte_schritte haelt fest, welche Teile eines Auftrags schon durch
-- sind (z. B. 'postfach', 'push'). Wird ein Auftrag nach einem Abbruch
-- wiederholt, laufen nur die fehlenden Teile -- niemand bekommt denselben
-- Push zweimal, nur weil das Postfach danach scheiterte.
--
-- schluessel (optional, eindeutig): Wer denselben Auftrag zweimal einreiht,
-- bekommt nur einen.
--
-- ADDITIV: eine neue Tabelle. Ein alter Server-Stand liest und schreibt sie
-- nicht und arbeitet waehrend eines Rolling Deploys wie bisher im Prozess;
-- Antwortformen aendern sich nicht.
--
-- IDEMPOTENT: CREATE ... IF NOT EXISTS; ein zweiter Lauf aendert nichts
-- (tests/schema/migration202NachlaufWarteschlange.test.js,
-- migrationenIdempotent.test.js).

CREATE TABLE IF NOT EXISTS nachlauf_auftraege (
  id BIGSERIAL PRIMARY KEY,
  art TEXT NOT NULL,
  parameter JSONB NOT NULL DEFAULT '{}'::jsonb,
  bezeichnung TEXT,
  schluessel TEXT,
  status TEXT NOT NULL DEFAULT 'offen',
  versuche INTEGER NOT NULL DEFAULT 0,
  max_versuche INTEGER NOT NULL DEFAULT 5,
  erledigte_schritte JSONB NOT NULL DEFAULT '[]'::jsonb,
  faellig_ab TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gesperrt_bis TIMESTAMPTZ,
  gesperrt_von TEXT,
  letzter_fehler TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erledigt_am TIMESTAMPTZ,
  CONSTRAINT nachlauf_auftraege_status_check
    CHECK (status IN ('offen', 'laeuft', 'erledigt', 'fehlgeschlagen'))
);

-- Eindeutiger Schluessel nur, wo einer gesetzt ist.
CREATE UNIQUE INDEX IF NOT EXISTS nachlauf_auftraege_schluessel_idx
  ON nachlauf_auftraege (schluessel) WHERE schluessel IS NOT NULL;

-- Der Arbeiter fragt nur unerledigte Auftraege ab; der Teilindex bleibt
-- klein, auch wenn erledigte bis zum Aufraeumen liegen.
CREATE INDEX IF NOT EXISTS nachlauf_auftraege_faellig_idx
  ON nachlauf_auftraege (faellig_ab) WHERE status IN ('offen', 'laeuft');

-- Aufraeumen nach Alter der erledigten/fehlgeschlagenen.
CREATE INDEX IF NOT EXISTS nachlauf_auftraege_erledigt_idx
  ON nachlauf_auftraege (erledigt_am) WHERE status IN ('erledigt', 'fehlgeschlagen');
