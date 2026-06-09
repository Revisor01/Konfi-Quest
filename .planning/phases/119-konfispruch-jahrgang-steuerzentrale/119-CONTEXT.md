# Phase 119: Konfispruch-Integration + Jahrgang-Steuerzentrale - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 119 liefert SPRUCH-07..11 — ABER der User hat den Scope in der Diskussion bewusst erweitert: Aus dem reinen "Konfispruch-Gate" wird eine **Jahrgang-Steuerzentrale**, in der pro Jahrgang ALLE Freigaben/Ziele zentral gesteuert werden.

Phase 119 umfasst (mehrere Plans, vom Planner geschnitten):

1. **Jahrgang-Steuerzentrale (Modal + Liste umbauen)** — der Jahrgang-Bereich wird die zentrale Steuerstelle pro Jahrgang:
   - Punkteziele festlegen (bestehend: target_gottesdienst/target_gemeinde + gottesdienst_enabled/gemeinde_enabled)
   - **NEU Konfispruch-Auswahl freischalten** (Toggle konfspruch_enabled pro Jahrgang)
   - **NEU Wrapped freigeben** (Toggle, der die Wrapped-Generierung pro Jahrgang triggert — siehe D-Wrapped)
   - Erklaertext in der Liste/im Modal erweitern (was hier gesteuert wird)
   - Liste zeigt pro Jahrgang: Punkteziele, ob/wann Wrapped gestartet wurde, ob Sprueche eingereicht werden duerfen

2. **Konfispruch pro-Jahrgang-Gate (SPRUCH-07)** — Konfi-Dashboard-Card "Dein Konfispruch" erscheint nur, wenn konfspruch_enabled fuer den Jahrgang true ist (sonst Card KOMPLETT WEG).

3. **Admin-Einsicht (SPRUCH-08)** — Admin sieht den gewaehlten Spruch eines Konfis in den Konfi-Details (neue Section).

4. **Anwesenheitsmatrix-Umschaltung + E-Mail-Versand (SPRUCH-09/10)** — Matrix bekommt Umschaltung Anwesenheit/Spruch; Admin kann sich die Anwesenheitsmatrix ODER die Sprueche-Liste **per E-Mail an sich selbst** schicken lassen (fuers Buero).

5. **Konfirmations-Termin-Umzug (Datenmodell-Aenderung)** — confirmation_date kommt GANZ aus dem Jahrgang RAUS, darf nirgends mehr beruecksichtigt werden (auch nicht im Konfi-Dashboard, auch nicht im Wrapped-Cron). Der Konfirmations-Termin lebt kuenftig NUR noch als Konfi-Event mit is_konfirmation-Flag (aus Phase 117).

6. **FAQ-Eintrag auf der WEBSITE (SPRUCH-11)** — eigener kleiner Plan: FAQ-Content NUR auf der Website (statisches HTML in frontend/public/), NICHT in der App.

**Nicht in dieser Phase (Deferred):** siehe `<deferred>`.

</domain>

<decisions>
## Implementation Decisions

### Konfispruch-Gate (SPRUCH-07)
- **D-01:** Gate ist ein **Boolean-Toggle pro Jahrgang** (`konfspruch_enabled BOOLEAN DEFAULT true`), KEIN Timestamp. Eingebaut GENAU dort, wo die bestehenden Punkte-Toggles sitzen (JahrgangModal in AdminJahrgaengeePage.tsx, Toggle-Reihe ~Z254-299, CSS-Klasse `app-toggle--jahrgang`).
- **D-02:** Solange konfspruch_enabled = false: Konfi-Dashboard-Card "Dein Konfispruch" ist **komplett weg** (nicht ausgegraut, nicht sichtbar). Backend liefert ein Flag (analog has_wrapped), Frontend rendert die Card nur bei true.
- **D-03:** Default true vs false fuer bestehende Jahrgaenge ist eine Planner-Detailfrage. ABER: Phase 118 hat die Card aktuell OHNE Gate gebaut (immer sichtbar). 119 fuehrt das Gate ein — der Planner muss sicherstellen, dass die Card jetzt am Flag haengt (sonst widerspricht 119 dem 118-Stand). Empfehlung: Default so waehlen, dass bestehende Konfis nicht ueberrascht werden — vom Planner mit Blick auf Prod-Daten entscheiden.

### Wrapped-Freigabe pro Jahrgang (Teil der Steuerzentrale)
- **D-Wrapped-1:** **Konfi-Wrapped wird per Toggle pro Jahrgang getriggert** (kein Cron mehr fuer Konfis). Toggle AN -> generiert Wrapped fuer alle Konfis des Jahrgangs (ruft die bestehende Logik POST /wrapped/generate/:jahrgangId-Aequivalent), MIT Warnhinweis vor dem Generieren. Toggle AUS -> loescht die Snapshots wieder (DELETE-Aequivalent, setzt wrapped_released_at auf NULL). Erneutes Einschalten -> generiert FRISCH mit aktuellen Daten. So gefahrlos testbar.
- **D-Wrapped-2:** **Teamer-Wrapped bleibt automatisch** — generiert jedes Jahr am **6.1.** (per Cron). KEIN Admin-Toggle fuer Teamer (es gibt keinen sinnvollen anderen Freigabe-Ort). Der bestehende Teamer-Cron (heute 1. Dezember, backgroundService.js ~Z409) muss auf 6.1. umgestellt werden.
- **D-Wrapped-3:** Hintergrund: Es gibt HEUTE KEINEN Admin-UI-Einstieg fuer Wrapped (Endpoints existieren, werden aber nur per Cron getriggert — deshalb sah der User Wrapped nie als Admin). Der Konfi-Wrapped-Cron (heute 1. des Monats, keyt auf jahrgaenge.confirmation_date) wird durch den Toggle ERSETZT und faellt fuer Konfis weg.
- **D-Wrapped-4:** Push-Notification: POST /generate verschickt heute automatisch eine Push ("Dein Konfi-Jahr ist da!"). Beim Toggle-Trigger ist das erwuenscht — aber beim TESTEN (mehrfaches An/Aus) ggf. stoerend. Planner-Detailfrage, ob Push beim Toggle optional/unterdrueckbar sein soll.

### Konfirmations-Termin-Umzug (Datenmodell)
- **D-04:** `jahrgaenge.confirmation_date` kommt **GANZ RAUS** — darf nirgends mehr beruecksichtigt werden. Betroffen mindestens: Wrapped-Cron (keyt heute darauf, backgroundService.js + wrapped.js), Konfi-Dashboard (darf den Termin nicht mehr zeigen/nutzen), Jahrgang-Modal/Liste (Feld raus). Der Konfirmations-Termin existiert kuenftig ausschliesslich als **Konfi-Event mit is_konfirmation = true** (Phase 117, Migration 091).
- **D-05:** Wo ein Konfirmations-Termin gebraucht wird (z.B. Sprueche-Liste fuers Buero, FAQ-Hinweis), wird er aus dem Konfirmations-Event abgeleitet, NICHT aus confirmation_date.

### Admin-Einsicht Konfi-Details (SPRUCH-08)
- **D-06:** Read-only Section im KonfiDetailView (Admin), die den gewaehlten Spruch zeigt (Liste: Referenz + Text der gewaehlten Uebersetzung; Freitext: Text + Referenz; oder "noch keiner"). Backend konfi-management.js GET /:id um die konfspruch-Daten erweitern (Builder-Logik existiert bereits in konfi.js:486-522 — uebernehmen). Neue Komponente analog der bestehenden Sections (KonfiDetailSections.tsx).

### Anwesenheitsmatrix Umschaltung + Versand (SPRUCH-09/10)
- **D-07:** Matrix bekommt eine Umschaltung (IonSegment) **Anwesenheit / Spruch**. Die **Spruch-Ansicht ist eine LISTE Konfi -> Spruch** (pro Konfi eine Zeile mit gewaehltem Spruch bzw. "noch keiner") — NICHT die Matrix-Zellen-Optik (Sprueche sind Volltext, passen nicht in Zellen).
- **D-08:** Versand = **E-Mail an den Admin selbst** (NICHT Chat). Aus der Matrix-Ansicht kann der Admin sich eine E-Mail schicken lassen mit (a) der Anwesenheitsmatrix ODER (b) der Sprueche-Liste — damit es ans Buero weitergegeben werden kann.
- **D-09:** Die **Sprueche-Liste in der E-Mail** muss pro Konfi enthalten: **Name + Konfirmationstermin** (Termin aus dem Konfirmations-Event, siehe D-05) + den Spruch.
- **D-10:** E-Mail-Versand nutzt den bestehenden emailService (vgl. sendLicenseExpiryReminderEmail). Empfaenger = der angemeldete Admin (eigene Adresse). Format (Tabelle/Text) ist Planner-Detail.

### FAQ (SPRUCH-11)
- **D-11:** FAQ kommt **NUR auf die Website** (statisches HTML in frontend/public/, z.B. landing.html oder neue faq.html), **NICHT in die App**. Kein DB-/Backend-/Admin-CRUD.
- **D-12:** Der FAQ-Eintrag erklaert das Konfispruch-Feature inkl. Hinweis auf die pro-Jahrgang-Freischaltung durch den Admin und den Konfirmations-Termin. Eigener kleiner Plan in Phase 119.

### Claude's Discretion
- Default-Wert von konfspruch_enabled fuer bestehende Jahrgaenge (D-03) — Planner entscheidet mit Blick auf Prod-Konsistenz zum 118-Stand.
- Genaues Plan-Schneiden innerhalb 119 (User: "Alles in 119, mehrere Plans").
- E-Mail-Format/Layout (D-10), Push-Unterdrueckung beim Wrapped-Toggle (D-Wrapped-4).
- Darstellung "Wrapped gestartet wann" in der Jahrgang-Liste.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-Vorgaenger (Vertrag + Stand)
- `.planning/phases/118-konfispruch-datenmodell/118-01-SUMMARY.md` — Backend-Vertrag Konfispruch (GET /konfsprueche, GET /profile.konfspruch, PATCH /profile, 4 Translation-Keys, konfspruch_translation-Spalte). MUSS gelesen werden.
- `.planning/phases/118-konfispruch-datenmodell/118-02-SUMMARY.md` — Frontend-Stand (Card/Modal, DEFAULT_KONFI_ORDER, section_order-Backfill). Die Card ist in 118 OHNE Gate gebaut — 119 fuehrt das Gate ein.
- `.planning/phases/118-CONTEXT.md` — Locked Decisions Konfispruch (Lizenz, 4 Uebersetzungen, Freitext-Pflichtreferenz) + die Scope-Grenze zu 119.
- `.planning/phases/117-konfirmations-event-flag/` (is_konfirmation-Flag, Migration 091) — Quelle des Konfirmations-Termins nach D-04/D-05.
- `.planning/REQUIREMENTS.md` — SPRUCH-07..11 (Wortlaut).

### Code-Integrationspunkte (verifiziert, Datei:Zeile)
- `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx` — JahrgangModal (Z77-342), Toggle-Reihe Gottesdienst Z254-262 / Gemeinde Z286-294 (`app-toggle--jahrgang`), Jahrgang-Interface Z56-68, FormData Z93-100, Submit-Payload Z135-142. HIER: konfspruch_enabled + Wrapped-Toggle einbauen, confirmation_date raus, Liste erweitern.
- `backend/routes/jahrgaenge.js` — POST Z56-91, PUT Z94-169 (akzeptiert gottesdienst_enabled/gemeinde_enabled/target_*), Validierung Z13-31, attendance-matrix GET /:id/attendance-matrix Z265-313.
- `backend/migrations/064_consolidate_inline_schemas.sql:114-118` — bestehende jahrgaenge *_enabled-Flags (Muster fuer konfspruch_enabled).
- `backend/migrations/075_wrapped.sql:20` — wrapped_released_at (TIMESTAMP).
- `backend/routes/wrapped.js` — POST /generate/:jahrgangId Z450-524 (setzt wrapped_released_at=NOW + Push Z498-507), POST /generate-teamer Z527, DELETE /:jahrgangId Z597 (setzt NULL). requireAdmin/requireOrgAdmin.
- `backend/services/backgroundService.js:400-488` — Wrapped-Cron (Konfi 1. d. Monats keyt auf confirmation_date; Teamer 1. Dezember -> auf 6.1. umstellen).
- `backend/routes/konfi.js` — GET /dashboard Z37-333 (section_order/show_*, has_wrapped Z284-295), GET /profile konfspruch-Builder Z486-522, Default section_order + konfispruch-Backfill Z267-281 (aus 118-Fix).
- `backend/routes/konfi-management.js:441-570` — Admin GET /:id (Konfi-Details). HIER: konfspruch-Daten ergaenzen (SPRUCH-08).
- `frontend/src/components/admin/views/KonfiDetailView.tsx` (Z40-150) + `KonfiDetailSections.tsx` (Sections Z29-31) — neue Konfispruch-Section (SPRUCH-08).
- `frontend/src/components/admin/modals/AttendanceMatrixModal.tsx` — Matrix (Laden Z99, Stats Z114-143, Suche Z145-154). HIER: Segment Anwesenheit/Spruch + E-Mail-Versand (SPRUCH-09/10).
- emailService (vgl. `sendLicenseExpiryReminderEmail`) — Muster fuer Admin-Selbst-E-Mail (D-10).
- `frontend/public/landing.html` (+ impressum/datenschutz/konto-loeschen.html) — Website-HTML fuer FAQ (D-11).

### Projektregeln
- `CLAUDE.md` — KEINE Emojis (nur IonIcons), echte Umlaute, useIonModal (nie IonModal isOpen), RBAC, deutsche UI-Texte, Tests mitschreiben, nach Frontend-Aenderung Xcode-Build.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app-toggle--jahrgang` CSS-Klasse + IonToggle-Muster (AdminJahrgaengeePage.tsx Z254ff) — direkt fuer konfspruch_enabled/Wrapped-Toggle nutzbar.
- has_wrapped-Gate-Muster (konfi.js Z284-295 + KonfiDashboardPage Z347) — Blaupause fuer das konfspruch-Gate (Card weg bei false).
- konfspruch-Builder (konfi.js Z486-522) — 1:1 fuer Admin-Einsicht (konfi-management GET /:id) wiederverwendbar.
- emailService (License-Reminder) — bestehender E-Mail-Versand fuer die Matrix-Mail.
- IonSegment-Muster (RequestsView.tsx:135-151) — fuer die Anwesenheit/Spruch-Umschaltung.
- Wrapped generate/delete-Endpoints (wrapped.js) — vom Toggle aus aufrufbar (statt nur Cron).

### Established Patterns
- jahrgaenge *_enabled-Felder sind BOOLEAN DEFAULT true (064) — konfspruch_enabled folgt diesem Muster.
- Org-/Rollen-Scoping: requireAdmin/requireOrgAdmin, organization_id-Filter.
- Migration-Runner by filename; naechste Migration ist 094 (093 = Konfispruch aus Phase 118).

### Integration Points
- jahrgaenge-Tabelle: +konfspruch_enabled (BOOLEAN), confirmation_date entfernen/ignorieren (Migration 094 + Code-Bereinigung).
- Wrapped-Toggle verzahnt Jahrgang-Modal <-> wrapped.js generate/delete <-> Push.
- Konfirmations-Termin: Konfi-Event (is_konfirmation, Phase 117) wird zur einzigen Termin-Quelle.

</code_context>

<specifics>
## Specific Ideas

- "Das ist die zentrale Steuerstelle" — der Jahrgang-Bereich soll pro Jahrgang ALLES buendeln: Punkteziele, Konfispruch-Freischaltung, Wrapped-Freigabe; Liste zeigt diese Zustaende auf einen Blick.
- Wrapped-Toggle "mit Warnhinweis" und gefahrlos testbar (An=generieren, Aus=loeschen, erneut An=frisch). Genau dieses Verhalten ist gewuenscht.
- Sprueche-Liste fuers Buero per E-Mail: "da muss dann auch der Name und der Konfirmationstermin stehen".
- Teamer-Wrapped: "da machen wir es automatisch. Ich wuesste nicht wo wir das sonst freigeben sollten" -> 6.1. jeden Jahres.
- confirmation_date: "kommt ganz raus, darf nicht mehr beruecksichtigt werden auch nicht im konfi dashboard. faellt einfach weg."

</specifics>

<deferred>
## Deferred Ideas

- **DB-gestuetztes FAQ-System in der App** (Tabelle + Route + Admin-CRUD) — bewusst NICHT jetzt; FAQ kommt erstmal nur als Website-Content. Falls spaeter In-App-Hilfe gewuenscht.
- **Groessere Wrapped-Ueberarbeitung (v1.2.0)** — die generelle "wer wann wie freischaltet"-Logik ueber den Konfi-Toggle hinaus (steht bereits als v1.2.0 auf der Roadmap). Phase 119 macht nur den Konfi-Toggle + Teamer-6.1.-Automatik.
- **In-App-Konfispruch-Hilfe/Info-Link** (Kontext-Link vom Konfispruch-Modal zur FAQ) — verworfen, da FAQ nur Website ist.

### Reviewed Todos (not folded)
None — keine Todos abgeglichen.

</deferred>

---

*Phase: 119-konfispruch-jahrgang-steuerzentrale*
*Context gathered: 2026-06-09*
