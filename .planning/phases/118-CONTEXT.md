# Phase 118 — Konfispruch: Datenmodell + Konfi-Auswahl — CONTEXT

**Milestone:** v2.12 Konfirmation + Konfispruch
**Liefert:** SPRUCH-01..06 (siehe REQUIREMENTS.md)

## Ziel

Konfis koennen ihren Konfirmationsspruch in der App waehlen (aus kuratierter Liste) ODER frei eintragen. Dashboard-Card "Dein Konfispruch" -> Auswahl-Modal mit Uebersetzungs-Tableiste.

## Locked Decisions (vom User bestaetigt)

1. **Kuratierte Liste in der DB**, leicht per Seed erweiterbar. KEINE externe API (Stabilitaetssorge).
2. **4 Uebersetzungen pro Vers:** Luther 2017, Bibel in gerechter Sprache, Gute Nachricht, Elberfelder. Umschaltbar per Tableiste im Modal.
3. **Lizenz:** Als Kirche (ACK-Mitglied, evangelische Landeskirche) duerfen die Uebersetzungstexte fuer einzelne Verse genutzt werden — vom User (Pastor) verantwortet/bestaetigt. KEIN Rechtsrisiko-Blocker.
4. **Inhalt-Befuellung:** Vers-REFERENZEN (Stellenangaben, frei) recherchiere ich (~20-30 klassische Konfsprueche). Die eigentlichen Uebersetzungs-TEXTE traegt der User per Seed aus den lizenzierten Quellen nach (NICHT aus dem Web kopieren — korrekte Ausgabe sicherstellen). Schema + Seed-Mechanik so bauen, dass Nachtragen trivial ist.
5. **Freitext-Eintrag:** Wenn Konfi eigenen Spruch eintraegt -> Text + PFLICHT-Stellenangabe (z.B. "Joh 3,16"). Freitext hat KEINE Uebersetzungs-Tabs (nur Listen-Sprueche haben die 4 Uebersetzungen).
6. **Dashboard-Card "Dein Konfispruch"** -> Klick oeffnet Auswahl-Modal via useIonModal.

## Datenmodell (Vorschlag fuer Planner — verifizieren/verfeinern)

- Tabelle `konfsprueche` (kuratierte Liste): id, reference (z.B. "Josua 1,9"), book, chapter, verse, organization_id NULL=global/systemweit, created_at. Sortierung/Aktiv-Flag erwaegen.
- Tabelle `konfspruch_uebersetzungen`: id, spruch_id FK, translation (ENUM/VARCHAR: 'luther2017'|'bigs'|'gute_nachricht'|'elberfelder'), text. Unique(spruch_id, translation).
- konfi_profiles erweitern: gewaehlter Spruch. Entweder FK `konfspruch_id` (Listen-Wahl) ODER Freitext-Felder `konfspruch_freitext` + `konfspruch_freitext_referenz` + gewaehlte `konfspruch_translation`. Genau EINE Quelle aktiv. Migration 093.

## Faktenbasis (aus Codebase-Exploration VERIFIZIERT, Datei:Zeile)

- **konfi_profiles** hat bereits eine Spalte `bible_translation` (konfi.js:344-354 selektiert sie)! -> WIEDERVERWENDEN als gewaehlte Standard-Uebersetzung statt neue Spalte. KEINE Spruch-Spalte sonst.
- **Konfi-Dashboard:** KonfiDashboardPage.tsx:94-339. useIonModal-Muster Z190-199 (PointsHistoryModal: onClose+presentingElement: pageRef.current). Sektion-Order Z263-269 aus dashboard_config (z.B. ['konfirmation','events','losung','badges','ranking']).
- **DashboardView.tsx:321-609** — sectionRenderers Record<string,()=>ReactNode>. NEUE Card = key 'konfispruch' + Renderer hier einfuegen. Bestehende `konfirmation`-Sektion Z325-372 ist die VORLAGE (gleiche Glass-Card-Optik).
- **Dashboard-CSS:** theme/variables.css: .app-dashboard-section Z2219, __bg-text Z2229, __bg-label Z2236, __content Z2247, Sektion-Modifier Z2258-2284 (neue .app-dashboard-section--konfispruch analog), .app-dashboard-glass-card Z2337, .app-dashboard-quote Z2345, .app-dashboard-cite Z2357. Card-Markup-Vorlage = konfirmation-Sektion.
- **Backend konfi.js:** GET /dashboard Z37-333, GET /profile Z336-494 (konfiId=req.user.id, type-Check :337-339). PATCH /profile fehlt noch -> neu, Muster: UPDATE konfi_profiles SET ... WHERE user_id=$1 AND organization_id=$2. RBAC: verifyTokenRBAC + req.user.type==='konfi' + user_id-Scope (KEIN Scope-Param noetig).
- **Modal-Vorlagen:** PointsHistoryModal.tsx (useIonModal, onClose), ChangeEmailModal.tsx (onClose+onSuccess, IonPage+Header+Content, app-modal-close-btn Z104).
- **Tab-Muster (fuer 4 Uebersetzungs-Tabs):** IonSegment/IonSegmentButton — RequestsView.tsx:137-151 ist die Referenz.
- **Migrationen:** letzte 092. Naechste **093**.
- **Tests:** truncateAll-Liste tests/helpers/db.js Z39-69 (konfsprueche + konfspruch_uebersetzungen ERGAENZEN — bei den anderen Lookup-Tabellen). Test-Muster tests/routes/konfi.test.js (beforeEach truncateAll+seed, konfiToken=generateToken('konfi1')).

## Projektregeln (KRITISCH)
- KEINE Emojis (nur IonIcons), ECHTE Umlaute (kein ae/oe/ue/ss)
- useIonModal (NIE IonModal isOpen)
- RBAC: Konfi darf nur eigenen Spruch setzen (verifyTokenRBAC, eigener user_id-Scope)
- Deutsche UI-Texte
- Tests mitschreiben (Backend-Integration echte PostgreSQL)
- Nach Frontend-Aenderung Xcode-Build (Human-Check)
- truncateAll in tests/helpers/db.js: neue Tabellen (konfsprueche, konfspruch_uebersetzungen) muessen rein — NICHT die badges-Falle wiederholen!

## Scope-Grenze zu Phase 119
- Phase 118: Datenmodell + Konfi-Auswahl + Card + Modal. Sichtbarkeit zunaechst OHNE pro-Jahrgang-Gate (Card sichtbar fuer Konfis).
- Phase 119 (spaeter): pro-Jahrgang-Freischaltung (Gate), Admin-Einsicht in Konfi-Details, Anwesenheitsmatrix-Umschaltung + Versand, FAQ.
