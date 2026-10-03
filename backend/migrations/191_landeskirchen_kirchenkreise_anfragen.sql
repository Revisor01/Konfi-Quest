-- 191_landeskirchen_kirchenkreise_anfragen.sql
--
-- Kirchenkreis und Landeskirche als Zuordnung an der Gemeinde und die
-- Anfragen vom Formular auf konfi-quest.de (Simon, 02.10.2026;
-- docs/planung/web-version.md, Entscheidungen 3, 4 und 6). Gemeinde zuerst:
-- Verwaltungsrechte fuer die oberen Ebenen gibt es nicht, die Zuordnung
-- dient der Statistik je Landeskirche, Kirchenkreis und Gemeinde.
--
-- 1. landeskirchen: Name eindeutig ohne Unterschied zwischen Gross- und
--    Kleinschreibung.
-- 2. kirchenkreise: Name, Landeskirche (darf fehlen; faellt sie weg, bleibt
--    der Kirchenkreis ohne). Eindeutig je Landeskirche und Name ohne
--    Gross/klein -- auch unter den Kirchenkreisen ohne Landeskirche, deshalb
--    COALESCE auf 0 (ein UNIQUE ueber eine NULL-Spalte griffe dort nicht).
-- 3. organizations.kirchenkreis_id, darf fehlen; faellt der Kirchenkreis
--    weg, faellt die Zuordnung weg. Die Textspalte organizations.kirchenkreis
--    (Migration 086) BLEIBT: Die Apps bis 2.3.0 lesen und schreiben nur sie.
--    Wer die Zuordnung setzt (PUT /organizations/:id, nur Super-Admin),
--    spiegelt den Namen hinein.
-- 4. Uebernahme: Jeder vorhandene Freitext wird ein Kirchenkreis ohne
--    Landeskirche und mit seinen Gemeinden verknuepft. Gleiche Schreibweisen
--    ohne Gross/klein und Randleerzeichen werden einer; als Name gilt die
--    Schreibweise der aeltesten Gemeinde (kleinste id). Die Textspalte
--    aendert sich nicht. Die Landeskirche ordnet der Support danach in der
--    Support-Ansicht zu.
-- 5. gemeinde_anfragen: eine Zeile je Anfrage vom Formular. status neu,
--    in_arbeit, angelegt oder abgelehnt; status_seit zaehlt die Frist fuer
--    abgelehnte Anfragen (180 Tage, danach loescht sie der naechtliche Lauf,
--    services/backgroundService.js); einwilligung_am haelt fest, wann die
--    Einwilligung erteilt wurde. organization_id nennt die Gemeinde, die
--    daraus entstanden ist; bearbeitet_von das Konto, das zuletzt etwas
--    daran geaendert hat (faellt mit dem Konto weg, utils/kontoLoeschen.js).
--
-- ADDITIV: Neue Tabellen, eine neue Spalte ohne Pflichtwert; bestehende
-- Zeilen behalten ihre Werte. Ein alter Server-Stand liest nichts, was es
-- nicht schon gab (organizations.* hat eine Spalte mehr -- nur ein Feld mehr
-- in GET /organizations).
--
-- VORHER IN PRODUKTION LESEND PRUEFEN (Bericht vom 03.10.2026):
--   SELECT id, display_name, kirchenkreis FROM organizations ORDER BY id;
--   SELECT lower(btrim(kirchenkreis)) AS k, COUNT(*) FROM organizations
--    WHERE NULLIF(btrim(kirchenkreis), '') IS NOT NULL GROUP BY 1 ORDER BY 1;
-- Die zweite Abfrage zeigt, welche Kirchenkreise entstehen.
--
-- SPERRE: ALTER TABLE organizations nimmt kurz ACCESS EXCLUSIVE (eine Zeile
-- je Gemeinde). Gemessen am 03.10.2026 auf der lokalen Test-Datenbank mit 50
-- Gemeinden, drei Laeufe: 21,7 bis 40,3 ms fuer die ganze Datei, ein zweiter
-- Lauf 2,4 ms.
--
-- IDEMPOTENT: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, Uebernahme
-- nur fuer Freitexte ohne gleichnamigen Kirchenkreis und Gemeinden ohne
-- Zuordnung (tests/schema/migration191Struktur.test.js,
-- migrationenIdempotent.test.js).

CREATE TABLE IF NOT EXISTS landeskirchen (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_landeskirchen_name
  ON landeskirchen (lower(name));

CREATE TABLE IF NOT EXISTS kirchenkreise (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  landeskirche_id BIGINT REFERENCES landeskirchen(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kirchenkreise_landeskirche_name
  ON kirchenkreise (COALESCE(landeskirche_id, 0), lower(name));

CREATE INDEX IF NOT EXISTS idx_kirchenkreise_landeskirche
  ON kirchenkreise (landeskirche_id);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS kirchenkreis_id BIGINT REFERENCES kirchenkreise(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_kirchenkreis
  ON organizations (kirchenkreis_id);

-- Uebernahme der Freitexte
INSERT INTO kirchenkreise (name, landeskirche_id)
SELECT (array_agg(btrim(o.kirchenkreis) ORDER BY o.id))[1], NULL
  FROM organizations o
 WHERE NULLIF(btrim(o.kirchenkreis), '') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM kirchenkreise k WHERE lower(k.name) = lower(btrim(o.kirchenkreis))
   )
 GROUP BY lower(btrim(o.kirchenkreis));

-- Verknuepfen, wo der Name genau einen Kirchenkreis trifft (gibt es ihn
-- spaeter in zwei Landeskirchen, bleibt eine noch offene Gemeinde ohne
-- Zuordnung, statt geraten zu werden).
UPDATE organizations o
   SET kirchenkreis_id = k.id
  FROM kirchenkreise k
 WHERE o.kirchenkreis_id IS NULL
   AND NULLIF(btrim(o.kirchenkreis), '') IS NOT NULL
   AND lower(k.name) = lower(btrim(o.kirchenkreis))
   AND (SELECT COUNT(*) FROM kirchenkreise k2 WHERE lower(k2.name) = lower(k.name)) = 1;

CREATE TABLE IF NOT EXISTS gemeinde_anfragen (
  id BIGSERIAL PRIMARY KEY,
  gemeinde TEXT NOT NULL,
  kirchenkreis TEXT,
  landeskirche TEXT,
  kontakt_name TEXT NOT NULL,
  funktion TEXT,
  email TEXT NOT NULL,
  mobil TEXT,
  anzahl_konfis INTEGER,
  anzahl_teamer INTEGER,
  nachricht TEXT,
  einwilligung_am TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'neu',
  status_seit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notiz TEXT,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  bearbeitet_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gemeinde_anfragen_status_check
    CHECK (status IN ('neu', 'in_arbeit', 'angelegt', 'abgelehnt')),
  CONSTRAINT gemeinde_anfragen_anzahlen_check
    CHECK ((anzahl_konfis IS NULL OR anzahl_konfis >= 0) AND (anzahl_teamer IS NULL OR anzahl_teamer >= 0))
);

CREATE INDEX IF NOT EXISTS idx_gemeinde_anfragen_status
  ON gemeinde_anfragen (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gemeinde_anfragen_organization
  ON gemeinde_anfragen (organization_id);
