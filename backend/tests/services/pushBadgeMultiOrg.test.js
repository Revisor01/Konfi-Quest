// Befund 28.08.2026, in Produktion gemessen: Die Zahl am App-Icon fehlte bei
// Multi-Org-Leitungen komplett.
//
// `berechneBadge` nahm die PRIMAER-Organisation aus users.organization_id.
// An einem echten Konto gemessen: Org 1 = 0, Org 2 = 0, Org 4 = 29 --
// gesendet wurde 0, weil Org 1 die Primaer-Org ist. iOS versteht badge: 0
// als "Zaehler entfernen": Der Push kam an, aber ohne Zahl, waehrend die
// Reiter IN der App die 29 korrekt zeigten (die kommen aus badge-counts fuer
// die aktive Organisation).
//
// Die aktive Organisation steht nur im Client-Token, nicht in der Datenbank.
// Der Push kann sie also nicht kennen -- deshalb die Summe ueber alle.
//
// Seit 27.09.2026 (Befund BF-12) kommen die Gemeinden JE PERSON mit ihrer
// dortigen Rolle aus orgMitglieder.ladeMitgliedschaftenVieler, und gezaehlt
// wird in EINER Runde ueber alle. Ob dabei richtig gezaehlt wird, pruefen
// appIconMehrereGemeinden.test.js und orgMitglieder.test.js gegen die echte
// Datenbank; hier nur die Verzweigung, die den Befund vom 28.08. ausmacht:
// WELCHE Organisationen gefragt werden.
const PushService = require('../../services/pushService');

describe('App-Icon-Zahl bei mehreren Organisationen', () => {
  const machDb = (orgIds, gefragt) => ({
    query: async (sql, params) => {
      // Die Mitgliedschaften (an is_primary zu erkennen): Org 1 ist die
      // Stamm-Gemeinde, die weiteren kommen aus user_organizations.
      if (/is_primary/.test(sql)) {
        return {
          rows: orgIds.map((id) => ({
            user_id: params[0][0],
            organization_id: id,
            role_name: 'org_admin',
            is_primary: id === 1,
            org_aktiv: true,
          })),
        };
      }
      // Alle weiteren Abfragen sind die Zaehler. Die Organisation steckt in
      // den Parametern -- bei den Bulk-Abfragen als Array (z.B. [[4]]),
      // deshalb flach machen.
      if (Array.isArray(params)) {
        for (const p of params.flat()) {
          if (orgIds.includes(p) && !gefragt.includes(p)) gefragt.push(p);
        }
      }
      return { rows: [] };
    }
  });

  it('fragt ALLE Organisationen ab, nicht nur die Primaer-Org', async () => {
    const gefragt = [];
    await PushService.berechneBadge(machDb([1, 2, 4], gefragt), 41);
    // Verbotener Fall: nur Org 1 (die Primaer-Org) -- so war es vor dem Fix.
    expect(gefragt).not.toEqual([1]);
    // Erlaubter Fall: alle drei kommen dran.
    expect(gefragt.sort()).toEqual([1, 2, 4]);
  });

  it('Single-Org: nur die eine Organisation', async () => {
    const gefragt = [];
    await PushService.berechneBadge(machDb([1], gefragt), 58);
    expect(gefragt).toEqual([1]);
  });

  it('die Zahl gehoert der Person: 0, wenn nirgends etwas offen ist -- nicht null', async () => {
    // null hiesse "nicht ermittelbar" und liesse den Push auf 1 zurueckfallen.
    expect(await PushService.berechneBadge(machDb([1, 2, 4], []), 41)).toBe(0);
  });
});
