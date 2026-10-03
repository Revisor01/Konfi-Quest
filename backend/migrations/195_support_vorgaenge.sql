-- 195: Support-Vorgaenge (Simon, 03.10.2026; docs/planung/support-vorgaenge.md).
--
-- "Alles ist ein Vorgang": Ein Vorgang ist ein Anliegen mit Nummer (id), Art,
-- Bereich, Dringlichkeit, Status, Betreff, Gemeinde (sobald bekannt) und
-- Verlauf. Er entsteht aus einer Anfrage vom Formular auf konfi-quest.de
-- (quelle 'anfrage', genau einer je Anfrage), aus dem Support-Formular auf der
-- Homepage ('formular'), aus einer Mail eines Kontos ('mail'), durch den
-- Support selbst ('support') -- oder die Mail liegt im Posteingang, bis sie
-- einsortiert wird.
--
-- 1. support_vorgaenge: eine Zeile je Vorgang. Faellt die Gemeinde oder die
--    Anfrage weg, geht der Vorgang mit (ON DELETE CASCADE); faellt das Konto
--    weg, das ihn angelegt hat (nur Support-Konten), wird erstellt_von leer
--    (utils/kontoLoeschen.js, 'nullen'). Die Angaben der Person aus dem
--    Formular (kontakt_*, gemeinde_angabe, einwilligung_am) stehen am Vorgang
--    und gehen mit ihm.
--    "Erledigt heisst Archiv": Ein erledigter Vorgang ist immer archiviert
--    (CHECK). Archivierte Vorgaenge loescht der naechtliche Lauf 730 Tage nach
--    dem Archivieren, wenn sie sich seitdem nicht geaendert haben; Vorgaenge
--    einer Anfrage folgen den Fristen der Anfrage
--    (services/backgroundService.js, cleanupArchivierteVorgaenge).
-- 2. mail_nachrichten.vorgang_id: der Vorgang, zu dem die Mail gehoert (fehlt
--    sie, liegt die Mail im Posteingang). Mit dem Vorgang gehen seine Mails.
--    anfrage_id und organization_id an der Mail bleiben gefuellt, solange der
--    Vorgang zu einer Anfrage bzw. Gemeinde gehoert -- die alten Routen
--    (Verlauf einer Anfrage, einer Gemeinde, Zaehler) lesen sie.
-- 3. mail_nachrichten.archiviert_am: eine archivierte Mail des Posteingangs
--    liegt nicht mehr im Eingang, bleibt aber lesbar (Archiv).
--
-- UEBERNAHME DES BESTANDS:
--   - Jede vorhandene Anfrage bekommt ihren Vorgang (Art neue_gemeinde, Quelle
--     anfrage, Betreff "Anfrage: <Gemeinde>", Beschreibung = Nachricht der
--     Anfrage, Notiz uebernommen). Status: neu -> neu, in_arbeit -> in_arbeit,
--     angelegt und abgelehnt -> erledigt (und damit archiviert, seit dem
--     Zeitpunkt der Entscheidung). Die Reihenfolge der Nummern folgt dem
--     Eingang der Anfragen.
--   - Ihre Mails bekommen vorgang_id.
--   - Mails einer Gemeinde ohne Anfrage kommen je Gemeinde in EINEN Vorgang
--     "Schriftwechsel" (Art sonstiges, Quelle mail; Status neu, wenn eine
--     eingehende Mail ungelesen ist, sonst in_arbeit -- so findet eine
--     Antwort auf eine alte Mail mit [Gemeinde N] im Betreff einen offenen
--     Vorgang).
--   Nicht zugeordnete Mails (Posteingang) bleiben im Posteingang.
--
-- ADDITIV: eine neue Tabelle, zwei neue Spalten ohne Pflichtwert. Alte
-- Server-Staende und alte Apps lesen nichts davon; die Antwortformen der
-- alten Routen aendern sich nicht.
--
-- IDEMPOTENT: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS; die
-- Uebernahme legt nur an, was noch keinen Vorgang hat (Anfragen ohne Vorgang,
-- Mails ohne vorgang_id mit Anfrage bzw. Gemeinde) -- ein zweiter Lauf aendert
-- nichts (tests/schema/migration195SupportVorgaenge.test.js,
-- migrationenIdempotent.test.js).

CREATE TABLE IF NOT EXISTS support_vorgaenge (
  id BIGSERIAL PRIMARY KEY,
  art TEXT NOT NULL,
  bereich TEXT,
  dringlichkeit TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'neu',
  status_seit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  betreff TEXT NOT NULL,
  beschreibung TEXT,
  quelle TEXT NOT NULL,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  anfrage_id BIGINT REFERENCES gemeinde_anfragen(id) ON DELETE CASCADE,
  erstellt_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kontakt_name TEXT,
  kontakt_email TEXT,
  kontakt_funktion TEXT,
  gemeinde_angabe TEXT,
  einwilligung_am TIMESTAMPTZ,
  notiz TEXT,
  archiviert_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_vorgaenge_anfrage_key UNIQUE (anfrage_id),
  CONSTRAINT support_vorgaenge_art_check CHECK (art IN
    ('neue_gemeinde', 'frage', 'fehler', 'wunsch', 'zugang', 'lizenz', 'datenschutz', 'sonstiges')),
  CONSTRAINT support_vorgaenge_bereich_check CHECK (bereich IS NULL OR bereich IN
    ('konfis', 'termine', 'punkte', 'challenges', 'chat', 'badges', 'material', 'konten', 'einstellungen', 'sonstiges')),
  CONSTRAINT support_vorgaenge_dringlichkeit_check CHECK (dringlichkeit IN ('normal', 'dringend')),
  CONSTRAINT support_vorgaenge_status_check CHECK (status IN ('neu', 'in_arbeit', 'wartet', 'erledigt')),
  CONSTRAINT support_vorgaenge_quelle_check CHECK (quelle IN ('anfrage', 'formular', 'mail', 'support')),
  -- Erledigt heisst Archiv.
  CONSTRAINT support_vorgaenge_erledigt_archiviert CHECK (status <> 'erledigt' OR archiviert_am IS NOT NULL),
  CONSTRAINT support_vorgaenge_betreff_check CHECK (btrim(betreff) <> '' AND char_length(betreff) <= 300),
  CONSTRAINT support_vorgaenge_text_laenge CHECK (
    (beschreibung IS NULL OR char_length(beschreibung) <= 5000)
    AND (notiz IS NULL OR char_length(notiz) <= 5000)
    AND (kontakt_name IS NULL OR char_length(kontakt_name) <= 200)
    AND (kontakt_email IS NULL OR char_length(kontakt_email) <= 254)
    AND (kontakt_funktion IS NULL OR char_length(kontakt_funktion) <= 200)
    AND (gemeinde_angabe IS NULL OR char_length(gemeinde_angabe) <= 200))
);

-- Listen und Filter der Support-Ansicht: offene Vorgaenge nach Status, das
-- Archiv nach Zeitpunkt, je Gemeinde (auch Fremdschluessel), je Art.
CREATE INDEX IF NOT EXISTS idx_support_vorgaenge_offen
  ON support_vorgaenge (status, updated_at DESC) WHERE archiviert_am IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_vorgaenge_archiv
  ON support_vorgaenge (archiviert_am DESC) WHERE archiviert_am IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_vorgaenge_organization
  ON support_vorgaenge (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_vorgaenge_art
  ON support_vorgaenge (art);
-- Fremdschluessel auf users: Kontoloeschung setzt NULL.
CREATE INDEX IF NOT EXISTS idx_support_vorgaenge_erstellt_von
  ON support_vorgaenge (erstellt_von) WHERE erstellt_von IS NOT NULL;

ALTER TABLE mail_nachrichten
  ADD COLUMN IF NOT EXISTS vorgang_id BIGINT REFERENCES support_vorgaenge(id) ON DELETE CASCADE;
ALTER TABLE mail_nachrichten
  ADD COLUMN IF NOT EXISTS archiviert_am TIMESTAMPTZ;

-- Verlauf eines Vorgangs, aelteste zuerst; ungelesene Mails je Vorgang
-- (rote Zahlen und Spalte "ungelesen").
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_vorgang
  ON mail_nachrichten (vorgang_id, gesendet_am) WHERE vorgang_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_vorgang_ungelesen
  ON mail_nachrichten (vorgang_id) WHERE vorgang_id IS NOT NULL AND richtung = 'ein' AND gelesen_am IS NULL;
-- Archiv des Posteingangs.
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_archiviert
  ON mail_nachrichten (archiviert_am DESC) WHERE archiviert_am IS NOT NULL;

-- UEBERNAHME 1: jede Anfrage ohne Vorgang bekommt ihren.
INSERT INTO support_vorgaenge
  (art, dringlichkeit, status, status_seit, betreff, beschreibung, quelle, organization_id, anfrage_id,
   notiz, archiviert_am, created_at, updated_at)
SELECT 'neue_gemeinde', 'normal',
       CASE a.status WHEN 'neu' THEN 'neu' WHEN 'in_arbeit' THEN 'in_arbeit' ELSE 'erledigt' END,
       a.status_seit,
       left('Anfrage: ' || a.gemeinde, 300),
       a.nachricht,
       'anfrage', a.organization_id, a.id,
       a.notiz,
       CASE WHEN a.status IN ('angelegt', 'abgelehnt') THEN a.status_seit END,
       a.created_at, a.updated_at
  FROM gemeinde_anfragen a
 WHERE NOT EXISTS (SELECT 1 FROM support_vorgaenge v WHERE v.anfrage_id = a.id)
 ORDER BY a.created_at, a.id;

-- UEBERNAHME 2: die Mails der Anfragen.
UPDATE mail_nachrichten m
   SET vorgang_id = v.id
  FROM support_vorgaenge v
 WHERE v.anfrage_id = m.anfrage_id AND m.vorgang_id IS NULL;

-- UEBERNAHME 3: Mails einer Gemeinde ohne Anfrage -> je Gemeinde ein Vorgang
-- "Schriftwechsel".
WITH gemeinden AS (
  SELECT m.organization_id,
         MIN(m.gesendet_am) AS erste,
         MAX(m.gesendet_am) AS letzte,
         bool_or(m.richtung = 'ein' AND m.gelesen_am IS NULL) AS ungelesen
    FROM mail_nachrichten m
   WHERE m.vorgang_id IS NULL AND m.organization_id IS NOT NULL
   GROUP BY m.organization_id
), neu AS (
  INSERT INTO support_vorgaenge
    (art, dringlichkeit, status, status_seit, betreff, quelle, organization_id, created_at, updated_at)
  SELECT 'sonstiges', 'normal',
         CASE WHEN g.ungelesen THEN 'neu' ELSE 'in_arbeit' END,
         g.erste, 'Schriftwechsel', 'mail', g.organization_id, g.erste, g.letzte
    FROM gemeinden g
   ORDER BY g.erste, g.organization_id
  RETURNING id, organization_id
)
UPDATE mail_nachrichten m
   SET vorgang_id = n.id
  FROM neu n
 WHERE m.organization_id = n.organization_id AND m.vorgang_id IS NULL;
