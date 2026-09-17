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
