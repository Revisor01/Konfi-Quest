# Phase 119: Konfispruch-Integration + Jahrgang-Steuerzentrale - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 119-konfispruch-jahrgang-steuerzentrale
**Areas discussed:** Gate-Mechanik (SPRUCH-07), Matrix-Umschaltung + Versand (SPRUCH-09/10), FAQ (SPRUCH-11) — plus emergent: Wrapped-Admin-Steuerung, Konfirmations-Termin-Umzug, Phasen-Scope

---

## Bereichswahl

| Option | Selected |
|--------|----------|
| Gate-Mechanik (SPRUCH-07) | ✓ |
| Matrix-Umschaltung + Versand (SPRUCH-09/10) | ✓ |
| FAQ (SPRUCH-11) | ✓ |
| Versand-Kanal-Details | (in Matrix gefaltet) |

---

## Gate-Mechanik (SPRUCH-07)

| Option | Description | Selected |
|--------|-------------|----------|
| An/Aus-Schalter pro Jahrgang | Boolean-Toggle konfspruch_enabled je Jahrgang | ✓ |
| Zeitstempel wie wrapped | konfspruch_released_at Timestamp | |
| Beides kombiniert | Toggle + optionales Datum | |

**User's choice:** Toggle pro Jahrgang — "im jahrgangsbereich haben wir ja auch schon pro jahrgang die punkte und da machen wir nen toggle rein und da machen wir auch nen toggle für das wrapped rein. das is ideal".
**Notes:** Loeste die Erkenntnis aus, dass es einen zentralen Jahrgang-Steuerort gibt -> Scope-Erweiterung zur Steuerzentrale + Wrapped-Toggle-Wunsch.

| Gesperrt-Zustand | Selected |
|------------------|----------|
| Card komplett weg | ✓ |
| Card deaktiviert + Hinweis | |

**User's choice:** Card komplett weg, solange Jahrgang nicht freigeschaltet.

---

## Wrapped-Admin-Steuerung (emergent)

**Kontext:** User sah Wrapped als Admin nie. Scout ergab: es gibt KEINEN Admin-UI-Einstieg fuer Wrapped — nur Cron triggert die Generierung (Konfi 1. d. Monats via confirmation_date, Teamer 1. Dezember).

**User's choice (Freitext):**
- Teamer-Wrapped automatisch am 6.1. jedes Jahres.
- Konfi-Wrapped per Jahrgang-Toggle: An = generieren (mit Warnhinweis), Aus = loeschen, erneut An = frisch generieren. Gefahrlos testbar. Kein Cron mehr fuer Konfis.
- Begruendung Teamer-Automatik: "Ich wuesste nicht wo wir das sonst freigeben sollten".

| Konf-Termin (confirmation_date) | Description | Selected |
|---------------------------------|-------------|----------|
| Ganz raus | Spalte faellt weg, Termin nur noch als Konfi-Event | ✓ |
| Feld behalten, nur UI raus | | |
| Im Planner klaeren | | |

**User's choice:** "kommt ganz raus, darf nicht mehr beruecksichtigt werden auch nicht im konfi dashboard. faellt einfach weg."

| Scope 119 | Selected |
|-----------|----------|
| Alles in 119, mehrere Plans | ✓ |
| Splitten in 119 + 120 | |
| Claude schlaegt Schnitt vor | |

**User's choice:** Alles in 119, Planner schneidet mehrere Plans.

---

## Matrix-Umschaltung + Versand (SPRUCH-09/10)

| Matrix-Spruch-Ansicht | Description | Selected |
|-----------------------|-------------|----------|
| Liste: Konfi -> Spruch | Pro Konfi eine Zeile mit Spruch | ✓ |
| Matrix-Optik beibehalten | Zellen zeigen Spruch-Status | |
| Du entscheidest | | |

**User's choice:** Liste Konfi -> Spruch.

**Versand (Freitext, korrigiert die Optionen):** "der admin kann sich in der matrix ansicht eine mail schicken lassen mit der anwesenheitsmatrix oder mit den spruechen, damit die ans buero koennen und in der sprueche liste muss dann auch der name und der konfirmationstermin stehen."
**Notes:** Versand = E-MAIL an den Admin selbst (NICHT Chat, wie urspruenglich als Option angeboten). Zwei Varianten: Anwesenheit ODER Sprueche-Liste. Sprueche-Liste braucht Name + Konfirmationstermin (Termin aus Konfi-Event, da confirmation_date wegfaellt).

---

## FAQ (SPRUCH-11)

| FAQ-Umfang | Description | Selected |
|------------|-------------|----------|
| Statische FAQ-Seite im Code (App) | | |
| DB-gestuetzt + Admin-pflegbar | | |
| Du entscheidest | | |

**User's choice (Freitext):** "FAQ nur auf der Website" / "Nur Website".
**Notes:** FAQ ist KEIN App-Feature. Website liegt als statisches HTML in frontend/public/. Als eigener kleiner Plan in 119 (Option "Als eigener Plan in 119" gewaehlt).

---

## Claude's Discretion

- Default-Wert konfspruch_enabled fuer bestehende Jahrgaenge (Prod-Konsistenz zu 118).
- Plan-Schnitt innerhalb 119.
- E-Mail-Format/Layout der Matrix-Mail.
- Push-Unterdrueckung beim mehrfachen Wrapped-Toggle (Test).
- Darstellung "Wrapped gestartet wann" in der Jahrgang-Liste.

## Deferred Ideas

- DB-gestuetztes In-App-FAQ-System (spaeter, falls gewuenscht).
- Groessere Wrapped-Ueberarbeitung (v1.2.0, bereits auf Roadmap) ueber den Konfi-Toggle hinaus.
- In-App-Konfispruch-Hilfe/Info-Link (verworfen, da FAQ nur Website).
