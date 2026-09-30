-- 186_refresh_tokens_obergrenze.sql
--
-- Den Bestand an offenen Refresh-Tokens auf die neue Grenze bringen
-- (Entscheidung Simon, 01.10.2026; Regel und Begruendung in
-- backend/utils/refreshTokenGrenze.js).
--
-- GEMESSEN (Produktion, 01.10.2026, nur lesend): 1.281 offene Tokens auf 133
-- Konten, das groesste mit 208. Ab jetzt setzt jede Ausgabe eines Tokens die
-- Grenze fuer ihr Konto durch -- aber nur fuer dieses, und erst bei der
-- naechsten Anmeldung. Diese Migration zieht den Bestand einmal nach:
--
--   1. je Konto und Geraet (device_id, Migration 171) bleibt das juengste
--      offene Token, aeltere desselben Geraets enden;
--   2. je Konto bleiben die zehn juengsten offenen Tokens, aeltere enden.
--
-- Wirkung am 01.10.2026 gemessen: 812 Tokens auf 12 Konten, davon 714 auf
-- Demo-, Review- und Testkonten der Bildschirmfoto-Laeufe; bei echten Konten
-- 30 Tokens auf 5 Konten, keines juenger als sieben Tage. Wer die App gerade
-- benutzt, behaelt sein Token: Es rotiert bei jeder Nutzung und ist deshalb
-- eines der juengsten.
--
-- "Enden" wie beim Abmelden: revoked_at UND expires_at auf jetzt -- keine
-- Gnadenfrist, kein Diebstahl-Signal, beim Refresh ein schlichtes 401, und die
-- App (auch 2.2.0 und 2.3.0) geht zur Anmeldung. Der Aufraeumlauf loescht die
-- Zeilen danach (expires_at liegt in der Vergangenheit).
--
-- NUR DATEN, keine Schemaaenderung. Idempotent: Ein zweiter Lauf findet kein
-- Token mehr ueber der Grenze. Die Zehn muss zu REFRESH_TOKENS_JE_KONTO in
-- utils/refreshTokenGrenze.js passen (tests/utils/migration186Bestand.test.js
-- prueft das).

WITH je_geraet AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, device_id
                            ORDER BY created_at DESC NULLS LAST, id DESC) AS rang
    FROM refresh_tokens
   WHERE revoked_at IS NULL AND expires_at > NOW() AND device_id IS NOT NULL
)
UPDATE refresh_tokens rt
   SET revoked_at = NOW(), expires_at = NOW()
  FROM je_geraet
 WHERE rt.id = je_geraet.id AND je_geraet.rang > 1;

WITH je_konto AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id
                            ORDER BY created_at DESC NULLS LAST, id DESC) AS rang
    FROM refresh_tokens
   WHERE revoked_at IS NULL AND expires_at > NOW()
)
UPDATE refresh_tokens rt
   SET revoked_at = NOW(), expires_at = NOW()
  FROM je_konto
 WHERE rt.id = je_konto.id AND je_konto.rang > 10;
