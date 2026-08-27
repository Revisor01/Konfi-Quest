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
const PushService = require('../../services/pushService');

describe('App-Icon-Zahl bei mehreren Organisationen', () => {
  // Statt appIconSummeOderNull zu mocken (der Import ist destrukturiert, ein
  // spaeteres Ersetzen am Modul-Objekt greift nicht mehr) wird hier die
  // Verzweigung geprueft, die den Befund ausmacht: WELCHE Organisationen
  // gefragt werden. Was je Organisation herauskommt, decken die Tests von
  // appIconBadge ab.
  const machDb = (orgIds, gefragt) => ({
    query: async (sql, params) => {
      if (/FROM users u/.test(sql)) {
        return { rows: [{ id: params[0], organization_id: 1, role_name: 'org_admin' }] };
      }
      if (/FROM user_organizations/.test(sql)) {
        return { rows: orgIds.map(id => ({ organization_id: id })) };
      }
      // Alle weiteren Abfragen kommen aus appIconSummeOderNull. Die
      // organization_id steckt in den Parametern -- so sehen wir, fuer welche
      // Organisationen ueberhaupt gerechnet wurde.
      // Die Organisation steckt in den Parametern -- bei den Bulk-Abfragen
      // als Array (z.B. [[4]]), deshalb flach machen.
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

  it('Single-Org: nur die eine Organisation, keine Summenschleife', async () => {
    const gefragt = [];
    await PushService.berechneBadge(machDb([1], gefragt), 58);
    expect(gefragt).toEqual([1]);
  });

  it('ladeOrganisationenFuerBadge nimmt die Primaer-Org immer mit', async () => {
    // Auch wenn user_organizations sie (noch) nicht fuehrt -- sonst faellt
    // genau die Organisation raus, in der die Person zuhause ist.
    const ids = await PushService.ladeOrganisationenFuerBadge(machDb([4], []), 41, 1);
    expect(ids.sort()).toEqual([1, 4]);
  });
});
