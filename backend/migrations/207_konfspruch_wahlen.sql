-- 207: Konfisprueche personenunabhaengig festhalten (docs/messung/umami.md, S1)
--
-- Simon, 09.10.2026: „Für die Sprüche will ich tatsächlich eine volle
-- Auswertung, auch wenn sie einzeln sind, insbesondere die, die selbst
-- eingetragen werden. Bitte macht da eine volle Speicherung. Das bleibt
-- personenunabhängig, aber ich will die Daten haben."
--
-- Je Wahl eine Zeile, OHNE Bezug auf Person, Konto oder Profil: welcher
-- Spruch (Kennung und Stelle zum Zeitpunkt der Wahl) in welcher Uebersetzung,
-- oder der eigene Spruch im Wortlaut mit Stellenangabe, dazu die Gemeinde und
-- der Monat. Geschrieben von utils/konfspruch.js (spruchWahlMerken) an den
-- beiden Stellen, an denen ein Spruch gespeichert wird (PATCH /konfi/profile,
-- PATCH /teamer/profile). Weil kein Verweis auf users besteht, bleibt die
-- Zeile bei einer Kontoloeschung stehen -- das ist der Zweck.
--
-- Ausgewertet nur in den Betreiber-Kennzahlen (GET /api/metrics/konfisprueche,
-- nur super_admin). Nichts davon geht an die Nutzungsmessung (Umami).
--
-- BESTAND: Die heute gespeicherten Sprueche aus konfi_profiles kommen einmal
-- herueber, mit monat NULL -- wann sie gewaehlt wurden, ist nicht bekannt
-- (die Profilzeile traegt nur ihr Anlagedatum).
--
-- ADDITIV: neue Tabelle, keine bestehende Spalte aendert sich.
-- IDEMPOTENT: IF NOT EXISTS; der Bestand kommt nur in eine leere Tabelle.

CREATE TABLE IF NOT EXISTS konfspruch_wahlen (
  id BIGSERIAL PRIMARY KEY,
  -- Gemeinde, in der gewaehlt wurde. Bleibt die Gemeinde nicht, bleibt die
  -- Wahl trotzdem (ohne Gemeinde).
  organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
  quelle VARCHAR(10) NOT NULL CHECK (quelle IN ('vorschlag', 'eigen')),
  -- Vorschlag: Kennung und Stelle. Die Stelle steht mit, damit die Zeile
  -- lesbar bleibt, wenn ein gemeindeeigener Spruch geloescht wird.
  konfspruch_id BIGINT REFERENCES konfsprueche(id) ON DELETE SET NULL,
  stelle VARCHAR(100),
  translation VARCHAR(30),
  -- Eigener Spruch: Wortlaut und Stellenangabe, wie eingegeben.
  freitext TEXT,
  freitext_referenz VARCHAR(100),
  -- Erster Tag des Monats der Wahl; NULL beim uebernommenen Bestand.
  monat DATE,
  CONSTRAINT konfspruch_wahlen_quelle_passt CHECK (
    (quelle = 'vorschlag' AND freitext IS NULL)
    OR (quelle = 'eigen' AND freitext IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_konfspruch_wahlen_monat ON konfspruch_wahlen (monat);
CREATE INDEX IF NOT EXISTS idx_konfspruch_wahlen_organization ON konfspruch_wahlen (organization_id);

INSERT INTO konfspruch_wahlen
  (organization_id, quelle, konfspruch_id, stelle, translation, freitext, freitext_referenz, monat)
SELECT kp.organization_id,
       CASE WHEN kp.konfspruch_id IS NOT NULL THEN 'vorschlag' ELSE 'eigen' END,
       kp.konfspruch_id,
       ks.reference,
       CASE WHEN kp.konfspruch_id IS NOT NULL THEN kp.konfspruch_translation END,
       CASE WHEN kp.konfspruch_id IS NULL THEN kp.konfspruch_freitext END,
       CASE WHEN kp.konfspruch_id IS NULL THEN kp.konfspruch_freitext_referenz END,
       NULL
  FROM konfi_profiles kp
  LEFT JOIN konfsprueche ks ON ks.id = kp.konfspruch_id
 WHERE (kp.konfspruch_id IS NOT NULL OR NULLIF(btrim(kp.konfspruch_freitext), '') IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM konfspruch_wahlen);
