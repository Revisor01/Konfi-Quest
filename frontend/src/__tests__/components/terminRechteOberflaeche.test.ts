// Die Oberflaeche bot Teamer:innen Knoepfe an, die das Backend mit 403 abweist
//
// STAND 16.09.2026 hat das Backend die Terminverwaltung auf die Leitung
// eingeschraenkt (routes/events/index.js: requireAdmin auf Anlegen, Aendern,
// Loeschen, Absagen, Serien). Der Kopfkommentar der Serien-Route sagt dazu:
// "Gesperrt wird in BEIDEN Ebenen: Oberflaeche und Backend."
//
// Die zweite Ebene fehlte. AdminEventsPage zaehlte weiter 'teamer' mit:
//
//   const canManageEvents = ['org_admin', 'admin', 'teamer'].includes(...)
//
// Teamer:innen sahen also "Neues Event anlegen", "Event absagen" und
// "Event loeschen" -- und bekamen beim Antippen einen 403. Ein Knopf, der nur
// fehlschlagen kann, ist schlimmer als kein Knopf.
//
// GEPRUEFT WERDEN BEIDE SEITEN: die Sperre fuer Teamer:innen UND dass die
// Leitung weiterhin durchkommt. Eine Sperre, die alle aussperrt, waere
// genauso kaputt.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { darfTermineVerwalten } from '../../utils/terminRechte';

describe('Terminverwaltung ist Leitungssache -- auch in der Oberflaeche', () => {
  it('VERBOTEN: Teamer:innen duerfen Termine nicht verwalten', () => {
    expect(darfTermineVerwalten({ role_name: 'teamer' })).toBe(false);
  });

  it('VERBOTEN: Konfis erst recht nicht', () => {
    expect(darfTermineVerwalten({ role_name: 'konfi' })).toBe(false);
  });

  it('ERLAUBT: admin darf', () => {
    expect(darfTermineVerwalten({ role_name: 'admin' })).toBe(true);
  });

  it('ERLAUBT: org_admin darf', () => {
    expect(darfTermineVerwalten({ role_name: 'org_admin' })).toBe(true);
  });

  it('Kein Konto, keine Rolle, leere Rolle -> gesperrt', () => {
    expect(darfTermineVerwalten(null)).toBe(false);
    expect(darfTermineVerwalten(undefined)).toBe(false);
    expect(darfTermineVerwalten({})).toBe(false);
    expect(darfTermineVerwalten({ role_name: '' })).toBe(false);
  });

  // Die Regel darf nicht zweimal existieren: Sobald eine Seite ihre eigene
  // Rollenliste fuehrt, laufen die beiden Staende auseinander -- genau so ist
  // der Befund ueberhaupt entstanden.
  it('AdminEventsPage fuehrt keine eigene Rollenliste mehr', () => {
    const quelle = readFileSync(
      resolve(process.cwd(), 'src/components/admin/pages/AdminEventsPage.tsx'),
      'utf8'
    );
    const ohneKommentare = quelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(ohneKommentare).toContain('darfTermineVerwalten');
    // Keine handgeschriebene Rollenliste mehr, die 'teamer' mitzaehlt.
    expect(ohneKommentare).not.toMatch(/\[\s*'org_admin',\s*'admin',\s*'teamer'\s*\]/);
  });
});

// Die Detailansicht ist fuer Teamer:innen offen -- die Verwaltungsaktionen
// darin sind es nicht (17.09.2026).
//
// Das Backend verlangt requireAdmin fuer Teilnehmer eintragen und entfernen,
// Anwesenheit verbuchen, Warteliste verschieben, Absagen, Zuruecknehmen und
// Chat anlegen. Die Ansicht bot all das an. Geprueft wird hier, dass jede
// dieser Stellen an darfVerwalten/darfEintragen haengt -- beides leitet sich
// aus darfTermineVerwalten ab.
describe('Detailansicht: Verwaltungsaktionen haengen am Leitungsrecht', () => {
  const lies = (pfad: string) =>
    readFileSync(resolve(process.cwd(), pfad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  const detail = lies('src/components/admin/views/EventDetailView.tsx');
  const abschnitte = lies('src/components/admin/views/EventDetailSections.tsx');

  it('darfEintragen und darfVerwalten leiten sich aus der Rollenregel ab', () => {
    expect(detail).toMatch(/const darfEintragen = !istAbgesagt\(eventData\) && darfTermineVerwalten\(user\)/);
    expect(detail).toMatch(/const darfVerwalten = darfTermineVerwalten\(user\)/);
  });

  it('Anwesenheit und Warteliste steigen ohne Recht sofort aus', () => {
    // Beide Action Sheets werden auch aus der Zeitfenster-Liste heraus
    // aufgerufen -- der Riegel muss deshalb in der Funktion sitzen, nicht nur
    // am Knopf.
    const anwesenheit = detail.slice(detail.indexOf('const showAttendanceActionSheet'));
    expect(anwesenheit.slice(0, 200)).toContain('if (!darfVerwalten) return;');
    const warteliste = detail.slice(detail.indexOf('const showWaitlistActionSheet'));
    expect(warteliste.slice(0, 200)).toContain('if (!darfVerwalten) return;');
  });

  it('Absagen und Absage zuruecknehmen nur mit Recht', () => {
    expect(detail).toContain('{eventData && darfVerwalten && (');
  });

  it('"Alle bestaetigen" verschwindet ohne Recht -- in beiden Sektionen', () => {
    const treffer = detail.match(/\|\| !darfVerwalten\) return null;/g) || [];
    expect(treffer.length).toBe(2);
  });

  it('Bearbeiten und Kopieren stehen nur der Leitung im Kopf', () => {
    // Von jedem der beiden Knoepfe aus rueckwaerts: Direkt davor muss die
    // Rechte-Bedingung stehen. (Nicht ueber <IonButtons slot="end"> suchen --
    // das kommt in der Datei mehrfach vor und trifft den falschen Block.)
    for (const knopf of ['aria-label="Termin kopieren"', 'aria-label="Event bearbeiten"']) {
      const stelle = detail.indexOf(knopf);
      expect(stelle).toBeGreaterThan(-1);
      expect(detail.slice(stelle - 120, stelle)).toContain('darfVerwalten && (');
    }
  });

  it('der Chat-Knopf bleibt, solange es einen Chat GIBT -- anlegen ist Leitungssache', () => {
    expect(detail).toContain('{(eventData?.chat_room_id || darfVerwalten) && (');
  });

  it('der QR-Knopf bleibt fuer das Team erreichbar', () => {
    // requireTeamer im Backend -- er darf NICHT an darfVerwalten haengen.
    const qrStelle = detail.indexOf('aria-label="QR-Code anzeigen"');
    expect(qrStelle).toBeGreaterThan(-1);
    // Die 120 Zeichen vor dem Knopf enthalten keine Rechte-Bedingung.
    expect(detail.slice(qrStelle - 120, qrStelle)).not.toContain('darfVerwalten');
  });

  it('die Zeitfenster-Liste ist der zweite Renderpfad und bekommt das Recht durchgereicht', () => {
    expect(detail).toContain('darfVerwalten={darfVerwalten}');
    expect(abschnitte).toContain('button={darfVerwalten}');
    expect(abschnitte).toContain('{darfVerwalten && !eventMandatory && (');
  });
});

// Kopieren gibt es an beiden Stellen, an denen Simon es wollte.
describe('Kopieren ist in Liste und Detailansicht erreichbar', () => {
  const lies = (pfad: string) =>
    readFileSync(resolve(process.cwd(), pfad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('in der Terminliste als Wisch-Aktion, nur mit Anlegerecht', () => {
    const seite = lies('src/components/admin/pages/AdminEventsPage.tsx');
    const liste = lies('src/components/admin/EventsView.tsx');
    expect(seite).toContain('onKopieren={canCreate ? handleKopiereEvent : undefined}');
    expect(liste).toContain('aria-label="Termin kopieren"');
  });

  it('die Kopie laeuft ueber kopiereTermin, nicht ueber eine zweite Handabschrift', () => {
    const seite = lies('src/components/admin/pages/AdminEventsPage.tsx');
    const detail = lies('src/components/admin/views/EventDetailView.tsx');
    expect(seite).toContain('kopiereTermin(');
    expect(detail).toContain('kopiereTermin(');
  });
});
