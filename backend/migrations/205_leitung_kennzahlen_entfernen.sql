-- 205: Die Kennzahlen-Wahl entfaellt (Simon, 09.10.2026,
-- docs/planung/darf-freigeben.md): „Du darfst nicht verwalten, dann brauchst
-- du es nicht sehen. Aber passiert bei Challenges was, dann guckst du es dir
-- gefaelligst an." Ueber Zahl, App-Symbol und Push entscheidet allein das
-- Recht je Jahrgang (utils/freigabeRechte.js, Spalten aus Migration 204).
--
-- Die Tabelle leitung_kennzahlen (Migration 204) liest und schreibt nichts
-- mehr. Keine ausgelieferte Store-App kannte sie: Die Routen
-- GET/PUT /notifications/kennzahlen gab es nur in einem Testbuild.
--
-- IDEMPOTENT: IF EXISTS. Der Index faellt mit der Tabelle.

DROP TABLE IF EXISTS leitung_kennzahlen;
