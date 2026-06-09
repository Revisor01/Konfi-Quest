---
status: resolved
phase: 119
depth: standard
reviewed: 2026-06-09T12:00:00Z
findings_critical: 2
findings_warning: 4
findings_info: 3
resolution: >
  CR-01 (commit dcf7fd5): Hard-Delete-Query um org_id + deleted_at IS NOT NULL ergaenzt,
    Soft-Delete symmetrisch org-gescoped. Hinweis: deleteKonfiCascade loescht den User
    physisch aus users -> keine echte Endlosschleife, Fix ist Defensive/Konsistenz.
  CR-02 (commit dcf7fd5): CR/LF aus dem SMTP-Subject (jahrgangName) gestrippt;
    adminName fliesst nur in den escapeten Body, kein Header.
  WR-01 (commit e364e99): DashboardView nutzt is_konfirmation-Flag, Titel nur Fallback.
  WR-02 (commit e364e99): canDismiss-Promise mit onDidDismiss-Fallback + backdropDismiss:false.
  WR-04 (commit e364e99): setSprueche(null) zu Beginn von loadSprueche.
  IN-03 (commit e364e99): sparkles -> sparklesOutline.
  WR-03 VERWORFEN: AdminEventsPage onClose setzt editEvent zurueck; separates dismiss-Prop
    wuerde diesen Reset ueberspringen -> bewusst unterschiedlicher Close-Pfad, kein Bug.
  IN-01: durch WR-01-Fix mit-adressiert (Flag statt String).
  IN-02 VERWORFEN: console.warn/error ist projektdurchgaengiger Stil, war nicht neu in 119.
files_reviewed_list:
  - backend/migrations/094_jahrgang_konfspruch_enabled.sql
  - backend/routes/jahrgaenge.js
  - backend/routes/konfi-management.js
  - backend/routes/konfi.js
  - backend/routes/users.js
  - backend/routes/wrapped.js
  - backend/services/backgroundService.js
  - backend/services/emailService.js
  - frontend/src/components/admin/modals/AttendanceMatrixModal.tsx
  - frontend/src/components/admin/modals/EventModal.tsx
  - frontend/src/components/admin/pages/AdminEventsPage.tsx
  - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
  - frontend/src/components/admin/views/EventDetailView.tsx
  - frontend/src/components/admin/views/KonfiDetailSections.tsx
  - frontend/src/components/admin/views/KonfiDetailView.tsx
  - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
  - frontend/src/components/konfi/views/DashboardView.tsx
---

# Phase 119: Code Review Report

**Reviewed:** 2026-06-09T12:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 119 implementiert die Jahrgang-Steuerzentrale (konfspruch_enabled-Toggle, Wrapped-Toggle, confirmation_date-Entkopplung) und die Admin-Einsicht auf Konfisprueche. Die meisten Anforderungen sind korrekt umgesetzt: Migration 094 ist idempotent, RBAC-Gating auf allen neuen Endpoints ist vollstaendig, die E-Mail geht nachweislich nur an die eigene Adresse der Admin:in, und das canDismiss-Pattern im Event-Modal ist korrekt (backdropDismiss:false schutzt vor haengendem Promise). Zwei Blocker wurden identifiziert: der Hard-Delete-Kandidaten-Query in runAutoDeletion fehlt ein org_id-Filter und ein IS NULL-Guard, und der plain-text-Teil der Matrix-E-Mail interpoliert adminName/jahrgangName ohne HTML-Escaping in den text-Kanal -- kein XSS-Risiko (plain text), aber Injektionsrisiko in den Subject-Header. Vier Warnungen betreffen subtile Logik-Schwaechen und eine fehlerhafte Konfirmationsdarstellung im Konfi-Dashboard.

---

## Critical Issues

### CR-01: Hard-Delete-Kandidaten-Query ohne org_id-Filter und ohne deleted_at-Guard

**File:** `backend/services/backgroundService.js:711-720`

**Issue:** Die Hard-Delete-Kandidaten-Query in `runAutoDeletion` filtert NUR nach `kp.jahrgang_id` und `r.name = 'konfi'`, aber NICHT nach `u.organization_id = jg.organization_id`. Da `jahrgaenge` globale IDs haben (kein Org-Filter auf den jahrgang.id-Wert selbst), ist ein Jahrgang-ID-Konflikt zwischen zwei Organisationen theoretisch ausgeschlossen -- aber Konfis koennen dennoch als Kandidaten geladen werden, wenn sie via `konfi_profiles.jahrgang_id` in einem fremden Jahrgang eingetragen sind (z.B. infolge eines frueheren Daten-Bugs oder Migration). Entscheidender: es fehlt `u.deleted_at IS NULL`, sodass bereits soft-geloeschte Konfis (`deleted_at IS NOT NULL`) erneut in `hardKandidaten` landen und `deleteKonfiCascade` aufgerufen wird -- dies ist ein idempotency-Fehler der jede Nacht auf soft-geloeschte User trifft die genau im 120-Tage-Fenster liegen. Die Soft-Delete-Query (Zeile 746-758) hat beide Guards korrekt (`u.deleted_at IS NULL` + Fenster `< 120`). Der Hard-Delete-Query hat nur das `>= 120`-Kriterium.

Vergleich: Soft-Delete-Query Z754: `AND u.deleted_at IS NULL` -- fehlt im Hard-Delete-Query.

**Fix:**
```javascript
const { rows: hardKandidaten } = await db.query(
  `SELECT u.id
     FROM users u
     JOIN konfi_profiles kp ON kp.user_id = u.id
     JOIN roles r ON u.role_id = r.id
    WHERE kp.jahrgang_id = $1
      AND u.organization_id = $2
      AND u.deleted_at IS NULL
      AND r.name = 'konfi'
      AND (CURRENT_DATE - $3::date) >= 120`,
  [jg.id, jg.organization_id, stichtag]
);
```

---

### CR-02: E-Mail-Subject-Header-Injection durch unescapte Nutzereingaben

**File:** `backend/services/emailService.js:294`

**Issue:** In `sendKonfiMatrixEmail` werden `adminName` und `jahrgangName` ohne jede Bereinigung direkt in den `subject`-String und den `text`-Body interpoliert:
```js
const subject = `${titel} - Jahrgang ${jahrgangName} - Konfi Quest`;
const text = `Hallo ${adminName},\n\nhier ist...`;
```
`jahrgangName` kommt aus `jahrgaenge.name` (admin-eingegeben), `adminName` aus `users.display_name`. Ein Jahrgang-Name mit einem Newline-Zeichen (`\r\n`) wuerde den SMTP-Subject-Header aufbrechen und ermoeglicht Header-Injection (z.B. zusaetzliche `To:`-Felder, BCC-Erweiterung). Das ist ein E-Mail-Header-Injection-Angriffspfad. Der HTML-Teil der Mail escaped korrekt via `escapeHtml()` (Z367-368), aber der subject-String ist ungekuerzt.

`titel` ist intern gebauter String (`'Konfisprueche'` oder `'Anwesenheit'`) -- kein Problem. `jahrgangName` und `adminName` sind Nutzereingaben.

**Fix:**
```javascript
// Hilfsfunktion fuer SMTP-Header-Safe-Strings (kein CRLF im Subject)
const sanitizeHeaderValue = (value) =>
  String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();

const subject = `${titel} - Jahrgang ${sanitizeHeaderValue(jahrgangName)} - Konfi Quest`;
// Im text-Teil ist Header-Injection nicht direkt moeglich, aber zur Konsistenz:
const greeting = sanitizeHeaderValue(adminName);
const text = `Hallo ${greeting},\n\nhier ist die ${titel}-Uebersicht...`;
```

---

## Warnings

### WR-01: Konfirmations-Section im Konfi-Dashboard sucht noch nach "konfirmation" im Event-Titel statt nach is_konfirmation-Flag

**File:** `frontend/src/components/konfi/views/DashboardView.tsx:229-238`

**Issue:** Die Konfirmations-Section nutzt `confirmationEvents` (Z229-231) und `nextConfirmationEvent` (Z238) fuer die Anzeige von Termin/Uhrzeit/Ort in der Countdown-Card. Diese Berechnung filtert `myRegisteredEvents` nach dem String `'konfirmation'` im `title` oder `name` des Events (Z230). Das ist genau das String-Matching, das mit Phase 119 Backend-seitig abgeschafft wurde. Die Backend-Logik liefert jetzt `days_to_confirmation` + `confirmation_date` + `confirmation_location` aus dem `is_konfirmation`-Event -- und wenn diese Felder gesetzt sind, zeigt die Sektion korrekt den Countdown (Z341-351). Aber fuer den Fallback-Zweig (Z353-378, wenn `days_to_confirmation` null ist) haengt das UI weiterhin am `nextConfirmationEvent` aus dem String-Match. Das ist inkonsistent und kann zu falscher Termin-Anzeige fuehren (ein event mit "konfirmation" im Titel ist kein `is_konfirmation`-Event).

**Fix:** Den `nextConfirmationEvent`-Fallback entweder ganz entfernen (Backend liefert jetzt korrekte Daten) oder auf ein separates Flag aus der API stuetzen (z.B. `dashboardData.konfirmation_event`). Solange Backend-Daten vorliegen, ist der String-Match-Pfad ein toter Code-Zweig der verwirrt.

---

### WR-02: canDismiss-Promise haengt bei IonAlert-Backdrop-Dismiss (kein onDidDismiss-Handler)

**File:** `frontend/src/components/admin/pages/AdminEventsPage.tsx:92-104` und `frontend/src/components/admin/views/EventDetailView.tsx:130-142`

**Issue:** `eventModalCanDismiss` gibt ein `Promise<boolean>` zurueck, das nur ueber die Button-Handler aufgeloest wird (`resolve(false)` / `resolve(true)`). Schliesst der Nutzer den IonAlert via Escape-Taste oder Backdrop (der Alert selbst hat kein `backdropDismiss: false`), feuert kein Button-Handler, und das Promise haengt dauerhaft unresolved. Das IonModal wartet dann ewig auf die Antwort und kann weder geoeffnet noch geschlossen werden -- die gesamte Events-Seite friert ein.

In `AdminEventsPage` ist `backdropDismiss: false` am Modal gesetzt, aber nicht am Alert. In `EventDetailView` (Z567) ebenfalls `backdropDismiss: false` nur am Modal, nicht am Alert.

**Fix:**
```typescript
const eventModalCanDismiss = async (): Promise<boolean> => {
  if (!eventModalDirtyRef.current) return true;
  return new Promise<boolean>((resolve) => {
    presentAlert({
      backdropDismiss: false,        // <-- Alert niemals via Backdrop schliessen
      header: 'Ungespeicherte Aenderungen',
      message: 'Moechtest du die Aenderungen verwerfen?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel', handler: () => resolve(false) },
        { text: 'Verwerfen', role: 'destructive', handler: () => resolve(true) }
      ]
    });
  });
};
```
Gleiches Muster in `EventDetailView.tsx:130-142` anwenden.

---

### WR-03: AdminEventsPage uebergibt kein `dismiss`-Prop an EventModal -- X-Button-Verhalten inkonsistent

**File:** `frontend/src/components/admin/pages/AdminEventsPage.tsx:75-88`

**Issue:** Das EventModal liest `dismiss` aus seinen Props und entscheidet in `doClose()` zwischen `dismiss()` und `onClose()`. In `AdminEventsPage` wird das Modal per `useIonModal` mit `onClose` und `onSuccess` konfiguriert, aber das `dismiss`-Prop fehlt. Dadurch ruft der X-Button im Modal `onClose()` auf, was `dismissEventModalHook()` und `setEditEvent(null)` ausfuehrt -- korrekt, aber durch einen anderen Code-Pfad als `dismiss`. In `EventDetailView.tsx:125` wird `dismiss: () => dismissEventModalHook()` dagegen explizit gesetzt, was die beabsichtigte Kette ist. Das ist eine Inkonsistenz: bei `AdminEventsPage` laeuft der X-Button ueber `onClose`, bei `EventDetailView` ueber `dismiss`. Wenn eine kuenftige Aenderung die Semantik von `onClose` vs `dismiss` trennt, bricht `AdminEventsPage` still.

**Fix:** In `AdminEventsPage` ebenfalls `dismiss: () => { dismissEventModalHook(); setEditEvent(null); }` ergaenzen, analog zu `EventDetailView`.

---

### WR-04: Sprueche-Liste wird nicht neu geladen, wenn der Jahrgang wechselt OHNE dass viewMode 'sprueche' aktiv ist

**File:** `frontend/src/components/admin/modals/AttendanceMatrixModal.tsx:156-162`

**Issue:** `loadSprueche` wird nur getriggert, wenn `jahrgangId && viewMode === 'sprueche'` gilt (Z160-162). Wechselt der Nutzer zuerst auf viewMode 'sprueche', laedt Daten fuer Jahrgang A, schaltet dann auf 'anwesenheit', wechselt den Jahrgang zu B und schaltet wieder auf 'sprueche' -- der useEffect bei viewMode-Change prueft `jahrgangId && viewMode === 'sprueche'` und triggert korrekt. OK. Aber: schaltet der Nutzer auf 'sprueche' und bleibt dabei, dann wechselt er nur `jahrgangId` (ohne viewMode zu wechseln) -- der erste Effect (Z156-158) laedt nur die Matrix-Daten neu, der zweite Effect (Z160-162) triggert nicht erneut, weil `jahrgangId` UND `viewMode` beide im Dependency-Array stehen und viewMode sich nicht geaendert hat.

Warte -- tatsaechlich: der zweite useEffect hat `[jahrgangId, viewMode]` als Dependencies. Bei Aenderung von `jahrgangId` (bei viewMode='sprueche') wuerde er erneut feuern, WENN `viewMode` schon 'sprueche' ist. Das stimmt technisch. Das Problem ist subtiler: `sprueche`-State wird beim Jahrgang-Wechsel NICHT sofort auf null zurueckgesetzt, sodass der Nutzer kurz veraltete Sprueche des alten Jahrgangs sieht. Eine klare Loading-Anzeige fehlt waehrend des Neu-Ladens beim Jahrgang-Wechsel (der `spruecheLoading`-State wird gesetzt, aber `filteredSprueche` zeigt noch alte Daten solange `sprueche !== null`).

**Fix:** In `loadSprueche` zu Beginn `setSprueche(null)` setzen, damit beim Jahrgang-Wechsel sofort der Leer-/Loading-Zustand erscheint:
```typescript
const loadSprueche = async (id: number) => {
  setSprueche(null);    // <-- sofort alten Stand loeschen
  setSpruecheLoading(true);
  ...
```

---

## Info

### IN-01: `confirmationEvents`-Filter nach Titel-String in DashboardView ist toter Code (redundant nach Phase 119 Backend-Umbau)

**File:** `frontend/src/components/konfi/views/DashboardView.tsx:229-231`

**Issue:** Der `confirmationEvents`-useMemo filtert weiterhin `myRegisteredEvents` nach `'konfirmation'` im Titel. Seit Phase 119 liefert das Backend `days_to_confirmation` und `confirmation_date` direkt -- die Title-Filterung ist nur noch ein Fallback-Pfad, der nie korrekte Ergebnisse liefert (ein "Konfirmations"-Event und ein `is_konfirmation`-Event sind nicht zwingend dasselbe). Dieser Code sollte zusammen mit WR-01 bereinigt werden.

---

### IN-02: `console.error` / `console.warn` in Produktions-Backend-Code

**File:** `backend/routes/jahrgaenge.js:51,89,169`, `backend/services/backgroundService.js` (mehrfach), `backend/routes/konfi.js` (mehrfach)

**Issue:** Viele Stellen nutzen `console.error` mit dem vollen Error-Objekt direkt in Error-Handlern von Express-Routen. Das ist in diesem Codebase durchgaengiger Stil und war in Phase 119 nicht neu einfuehrt. Es ist als Info-Finding fuer Vollstaendigkeit vermerkt. Wichtiger: `backend/routes/konfi.js:444` haengt `console.warn` vor den Fallback-Kommentar fuer den Konfirmationstermin -- der Kommentar sagt "kein Fallback mehr", aber `console.warn` bleibt, was verwirrend ist.

**Fix:** `console.warn` in `konfi.js:444` entfernen; der Try/Catch-Block ohne Fallback reicht.

---

### IN-03: `sparkles`-Icon ist kein `sparklesOutline` -- visuell inkonsistent mit anderen Outline-Icons in der gleichen Card

**File:** `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx:38,391`

**Issue:** Das Icon `sparkles` (filled) wird fuer die "Konfispruch & Wrapped"-Sektion-Header verwendet, waehrend die anderen Sektions-Header `settingsOutline` (outline) und `school` (filled) nutzen. Im selben File wird `schoolOutline` fuer die Liste und `school` fuer die Sektionen gemischt. Das ist kein Bug, aber eine stilistische Inkonsistenz gegenueber dem bestehenden Outline-Pattern der anderen Sektionen in anderen Modals (z.B. `schoolOutline`, `settingsOutline`).

**Fix:** `sparklesOutline` statt `sparkles` importieren/verwenden -- identisch verfuegbar in ionicons/icons.

---

_Reviewed: 2026-06-09T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
