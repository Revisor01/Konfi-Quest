-- 193: Support-Mail -- Anfragen beantworten, Postfaecher lesen und sortieren
-- (Simon, 03.10.2026; docs/planung/support-mail.md).
--
-- 1. mail_nachrichten: eine Zeile je Mail, ein- oder ausgehend, aus den
--    Postfaechern "moin" (Anfragen, Erstkontakt) und "support" (Hilfe fuer
--    bestehende Gemeinden). Zugeordnet zu einer Anfrage ODER einer Gemeinde
--    oder keinem von beiden (= Posteingang, nicht zugeordnet) -- nie beides
--    (CHECK). Faellt die Anfrage oder die Gemeinde weg, gehen ihre Mails mit
--    (ON DELETE CASCADE); nicht zugeordnete loescht der naechtliche Lauf nach
--    180 Tagen (services/backgroundService.js, cleanupNichtZugeordneteMails).
--    Nur Klartext (hoechstens 50.000 Zeichen), von Anhaengen nur Name,
--    Groesse und Typ. message_id ist eindeutig: dieselbe Mail zweimal (in
--    beiden Postfaechern, oder ein zweiter Abholversuch) wird nicht doppelt
--    gespeichert. verfasst_von nennt das Konto, das eine Antwort geschrieben
--    hat; es faellt mit dem Konto weg (utils/kontoLoeschen.js, 'nullen').
-- 2. mail_abholstand: je Postfach der Stand des Abholens per IMAP
--    (UIDVALIDITY, letzte UID) und der letzte Fehler -- ohne Inhalte, ohne
--    Adressen.
-- 3. mail_bausteine: Textbausteine fuer Antworten mit Platzhaltern
--    ({{name}}, {{gemeinde}}, {{lizenz}}, {{testphase_bis}}, {{benutzername}},
--    {{absender}}); postfach NULL = fuer beide. Die Startliste kommt nur in
--    eine leere Tabelle -- ein zweiter Lauf legt nichts wieder an, was
--    jemand geloescht oder umbenannt hat.
-- 4. mail_einstellungen: Fusszeile und Absendername der Antworten. Im Code
--    steht nur ein neutraler Vorschlag ohne Personennamen (das Repo ist
--    oeffentlich); gepflegt wird in der Support-Ansicht. Dieselben Werte
--    stehen als Rueckfall in backend/utils/mailEinstellungen.js
--    (tests/schema/migration193SupportMail.test.js haelt beide gleich).
--
-- ADDITIV: nur neue Tabellen. Alte Server-Staende und alte Apps lesen sie
-- nicht. IDEMPOTENT: CREATE ... IF NOT EXISTS, Startwerte nur in leere
-- Tabellen bzw. ON CONFLICT DO NOTHING (migrationenIdempotent.test.js).

CREATE TABLE IF NOT EXISTS mail_nachrichten (
  id BIGSERIAL PRIMARY KEY,
  postfach TEXT NOT NULL,
  richtung TEXT NOT NULL,
  anfrage_id BIGINT REFERENCES gemeinde_anfragen(id) ON DELETE CASCADE,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  in_reply_to TEXT,
  referenzen TEXT[] NOT NULL DEFAULT '{}',
  von_adresse TEXT,
  von_name TEXT,
  an_adressen TEXT[] NOT NULL DEFAULT '{}',
  betreff TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  anhaenge JSONB NOT NULL DEFAULT '[]'::jsonb,
  gesendet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gelesen_am TIMESTAMPTZ,
  verfasst_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  imap_uid BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mail_nachrichten_message_id_key UNIQUE (message_id),
  CONSTRAINT mail_nachrichten_postfach_check CHECK (postfach IN ('moin', 'support')),
  CONSTRAINT mail_nachrichten_richtung_check CHECK (richtung IN ('ein', 'aus')),
  CONSTRAINT mail_nachrichten_eine_zuordnung CHECK (anfrage_id IS NULL OR organization_id IS NULL),
  CONSTRAINT mail_nachrichten_text_laenge CHECK (char_length(text) <= 50000)
);

-- Verlauf je Anfrage bzw. Gemeinde, aelteste zuerst.
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_anfrage
  ON mail_nachrichten (anfrage_id, gesendet_am) WHERE anfrage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_organization
  ON mail_nachrichten (organization_id, gesendet_am) WHERE organization_id IS NOT NULL;

-- Posteingang (nicht zugeordnet), neueste zuerst; und das Aufraeumen nach
-- 180 Tagen (gezaehlt ab created_at: seit wann die Mail in Konfi Quest liegt).
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_eingang
  ON mail_nachrichten (gesendet_am DESC) WHERE anfrage_id IS NULL AND organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_eingang_alter
  ON mail_nachrichten (created_at) WHERE anfrage_id IS NULL AND organization_id IS NULL;

-- Ungelesene eingehende Mails (rote Zahlen).
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_ungelesen
  ON mail_nachrichten (anfrage_id, organization_id) WHERE richtung = 'ein' AND gelesen_am IS NULL;

-- Faeden: In-Reply-To und References (utils/mailZuordnung.js, Regel 1;
-- Verlauf und Zuordnen ueber den ganzen Faden).
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_in_reply_to
  ON mail_nachrichten (in_reply_to) WHERE in_reply_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_referenzen
  ON mail_nachrichten USING gin (referenzen);

-- Fremdschluessel auf users: Kontoloeschung setzt NULL.
CREATE INDEX IF NOT EXISTS idx_mail_nachrichten_verfasst_von
  ON mail_nachrichten (verfasst_von) WHERE verfasst_von IS NOT NULL;

CREATE TABLE IF NOT EXISTS mail_abholstand (
  postfach TEXT PRIMARY KEY,
  uidvalidity BIGINT,
  letzte_uid BIGINT,
  abgeholt_am TIMESTAMPTZ,
  fehler TEXT,
  fehler_am TIMESTAMPTZ,
  CONSTRAINT mail_abholstand_postfach_check CHECK (postfach IN ('moin', 'support'))
);

CREATE TABLE IF NOT EXISTS mail_bausteine (
  id BIGSERIAL PRIMARY KEY,
  titel TEXT NOT NULL,
  betreff TEXT,
  text TEXT NOT NULL,
  postfach TEXT,
  sortierung INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bearbeitet_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT mail_bausteine_postfach_check CHECK (postfach IS NULL OR postfach IN ('moin', 'support'))
);

CREATE INDEX IF NOT EXISTS idx_mail_bausteine_bearbeitet_von
  ON mail_bausteine (bearbeitet_von) WHERE bearbeitet_von IS NOT NULL;

CREATE TABLE IF NOT EXISTS mail_einstellungen (
  schluessel TEXT PRIMARY KEY,
  wert TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bearbeitet_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT mail_einstellungen_schluessel_check CHECK (schluessel IN ('fusszeile', 'absendername'))
);

-- Startliste der Textbausteine -- nur in eine leere Tabelle.
INSERT INTO mail_bausteine (titel, betreff, text, postfach, sortierung)
SELECT b.titel, NULL, b.text, b.postfach, b.sortierung
  FROM (VALUES
    ('Eingang bestätigt / Rückfrage',
     E'Hallo {{name}},\n\nvielen Dank für eure Anfrage für {{gemeinde}}! Sie ist bei uns angekommen, und wir melden uns in den nächsten Tagen mit allem, was ihr für den Start braucht.\n\nVorab haben wir noch eine Frage: …\n\nViele Grüße\n{{absender}}',
     'moin', 10),
    ('Zugangsdaten unterwegs',
     E'Hallo {{name}},\n\neure Gemeinde {{gemeinde}} ist in Konfi Quest eingerichtet. Der Benutzername für eure Gemeindeleitung lautet: {{benutzername}}\n\nDas Passwort schicken wir euch nicht per Mail, sondern auf einem anderen Weg. Nach der ersten Anmeldung könnt ihr es in der App selbst ändern.\n\nDie Testphase läuft bis zum {{testphase_bis}}. Die ersten Schritte stehen im Handbuch: konfi-quest.de/docs\n\nViele Grüße\n{{absender}}',
     'moin', 20),
    ('Testphase endet bald',
     E'Hallo {{name}},\n\ndie Testphase von Konfi Quest für {{gemeinde}} endet am {{testphase_bis}}. Danach ist die Anmeldung gesperrt, bis eine Lizenz eingetragen ist.\n\nWollt ihr weitermachen, gebt uns kurz Bescheid, welche Lizenz zu euch passt. Gewünscht hattet ihr: {{lizenz}}\n\nHabt ihr Fragen, antwortet einfach auf diese Mail.\n\nViele Grüße\n{{absender}}',
     'support', 30),
    ('Lizenzangebot',
     E'Hallo {{name}},\n\ngern machen wir euch ein Angebot für Konfi Quest in {{gemeinde}}:\n\n{{lizenz}}\n\nSagt uns einfach Bescheid, dann tragen wir die Lizenz für euch ein.\n\nViele Grüße\n{{absender}}',
     NULL, 40),
    ('Absage',
     E'Hallo {{name}},\n\nvielen Dank für euer Interesse an Konfi Quest. Leider können wir eure Anfrage für {{gemeinde}} im Moment nicht annehmen.\n\nFür eure Konfi-Arbeit wünschen wir euch alles Gute und Gottes Segen.\n\nViele Grüße\n{{absender}}',
     'moin', 50)
  ) AS b (titel, text, postfach, sortierung)
 WHERE NOT EXISTS (SELECT 1 FROM mail_bausteine);

-- Neutrale Vorschlaege ohne Personennamen; ein vorhandener Wert bleibt.
INSERT INTO mail_einstellungen (schluessel, wert) VALUES
  ('fusszeile', E'Konfi Quest · Digitale Konfi-Arbeit\nkonfi-quest.de · Handbuch: konfi-quest.de/docs · Datenschutz: konfi-quest.de/datenschutz'),
  ('absendername', 'Konfi Quest')
ON CONFLICT (schluessel) DO NOTHING;
