// backend/tests/utils/jahrgangZugriffHelfer.test.js
//
// Unit-Tests für checkJahrgangAccess und filterByJahrgangAccess aus
// middleware/rbac.js.
//
// ACHTUNG — beide Helfer sind derzeit NICHT eingehaengt: checkJahrgangAccess
// wird in keiner Route als Middleware benutzt, filterByJahrgangAccess wird an
// konfi-management durchgereicht und dort nie aufgerufen. Diese Tests sichern
// deshalb die REGEL, nicht eine wirksame Route: Wer einen der Helfer künftig
// einhaengt, bekommt hier den verbindlichen Vertrag.
//
// Regel (31.08.2026):
//   super_admin -> kein Zugriff auf Jahrgangs-Daten
//   org_admin   -> alle Jahrgänge der Organisation
//   admin       -> NUR die zugewiesenen Jahrgänge (wie ein Teamer)
//   teamer      -> nur die zugewiesenen Jahrgänge
const { checkJahrgangAccess, filterByJahrgangAccess } = require('../../middleware/rbac');

// Minimaler Request-Stub. assigned_jahrgaenge hat dieselbe Form wie in
// rbac.js (verifyTokenRBAC): { id, name, can_view, can_edit }.
function req(role, jahrgaenge = [], params = {}) {
  return {
    user: {
      id: 1,
      role_name: role,
      organization_id: 1,
      assigned_jahrgaenge: jahrgaenge,
    },
    params,
    body: {},
    query: {},
  };
}

// res-Stub, der Status und Body festhaelt.
function res() {
  const out = { statusCode: null, body: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { out.body = payload; return out; };
  return out;
}

// Fuehrt die Middleware aus und liefert zurueck, ob next() gerufen wurde.
function run(middleware, request) {
  const antwort = res();
  let weiter = false;
  middleware(request, antwort, () => { weiter = true; });
  return { weiter, status: antwort.statusCode, body: antwort.body };
}

const JG_EIGEN = { id: 10, name: 'Eigener', can_view: true, can_edit: true };
const JG_NUR_LESEN = { id: 11, name: 'Nur lesen', can_view: true, can_edit: false };

describe('checkJahrgangAccess', () => {
  const middleware = checkJahrgangAccess('jahrgangId');
  const middlewareEdit = checkJahrgangAccess('jahrgangId', true);

  it('super_admin bekommt 403 (kein Zugriff auf Jahrgangs-Daten)', () => {
    const ergebnis = run(middleware, req('super_admin', [], { jahrgangId: '10' }));
    expect(ergebnis.weiter).toBe(false);
    expect(ergebnis.status).toBe(403);
  });

  it('org_admin kommt ohne jede Zuweisung durch (von der Bindung ausgenommen)', () => {
    const ergebnis = run(middleware, req('org_admin', [], { jahrgangId: '10' }));
    expect(ergebnis.weiter).toBe(true);
    expect(ergebnis.status).toBe(null);
  });

  it('admin MIT Zuweisung auf den angefragten Jahrgang kommt durch', () => {
    const ergebnis = run(middleware, req('admin', [JG_EIGEN], { jahrgangId: '10' }));
    expect(ergebnis.weiter).toBe(true);
    expect(ergebnis.status).toBe(null);
  });

  it('admin OHNE Zuweisung bekommt 403 (frueher kam er durch)', () => {
    const ergebnis = run(middleware, req('admin', [], { jahrgangId: '10' }));
    expect(ergebnis.weiter).toBe(false);
    expect(ergebnis.status).toBe(403);
    expect(ergebnis.body.error).toBe('Kein Zugriff auf diesen Jahrgang');
  });

  it('admin mit Zuweisung auf einen ANDEREN Jahrgang bekommt 403', () => {
    const ergebnis = run(middleware, req('admin', [JG_EIGEN], { jahrgangId: '99' }));
    expect(ergebnis.weiter).toBe(false);
    expect(ergebnis.status).toBe(403);
  });

  it('admin ohne can_edit bekommt bei requireEdit 403, ohne requireEdit aber Zugriff', () => {
    const gesperrt = run(middlewareEdit, req('admin', [JG_NUR_LESEN], { jahrgangId: '11' }));
    expect(gesperrt.weiter).toBe(false);
    expect(gesperrt.status).toBe(403);
    expect(gesperrt.body.error).toBe('Keine Bearbeitungsrechte für diesen Jahrgang');

    const erlaubt = run(middleware, req('admin', [JG_NUR_LESEN], { jahrgangId: '11' }));
    expect(erlaubt.weiter).toBe(true);
    expect(erlaubt.status).toBe(null);
  });

  it('teamer unveraendert: zugewiesen -> durch, fremd -> 403', () => {
    const erlaubt = run(middleware, req('teamer', [JG_EIGEN], { jahrgangId: '10' }));
    expect(erlaubt.weiter).toBe(true);

    const verboten = run(middleware, req('teamer', [JG_EIGEN], { jahrgangId: '99' }));
    expect(verboten.weiter).toBe(false);
    expect(verboten.status).toBe(403);
  });

  it('ohne Jahrgang-ID im Request -> 400 (gilt fuer admin wie fuer teamer)', () => {
    const ergebnis = run(middleware, req('admin', [JG_EIGEN], {}));
    expect(ergebnis.weiter).toBe(false);
    expect(ergebnis.status).toBe(400);
  });
});

describe('filterByJahrgangAccess', () => {
  it('super_admin sieht nichts', () => {
    const filter = filterByJahrgangAccess(req('super_admin', [JG_EIGEN]));
    expect(filter.where).toBe('WHERE 1=0');
    expect(filter.params).toEqual([]);
  });

  it('org_admin sieht die ganze Organisation, ohne Jahrgangs-Bedingung', () => {
    const filter = filterByJahrgangAccess(req('org_admin', []));
    expect(filter.where).toBe('WHERE organization_id = $1');
    expect(filter.params).toEqual([1]);
  });

  it('admin MIT Zuweisung bekommt die Jahrgangs-Bedingung (frueher: ganze Org)', () => {
    const filter = filterByJahrgangAccess(req('admin', [JG_EIGEN, JG_NUR_LESEN]));
    expect(filter.where).toBe('WHERE organization_id = $1 AND jahrgang_id IN ($2,$3)');
    expect(filter.params).toEqual([1, 10, 11]);
  });

  it('admin OHNE Zuweisung sieht nichts', () => {
    const filter = filterByJahrgangAccess(req('admin', []));
    expect(filter.where).toBe('WHERE 1=0');
    expect(filter.params).toEqual([]);
  });

  it('can_view=false zaehlt nicht mit', () => {
    const filter = filterByJahrgangAccess(req('admin', [
      { id: 10, can_view: false, can_edit: false },
      JG_NUR_LESEN,
    ]));
    expect(filter.where).toBe('WHERE organization_id = $1 AND jahrgang_id IN ($2)');
    expect(filter.params).toEqual([1, 11]);
  });

  it('teamer unveraendert: nur die zugewiesenen Jahrgänge', () => {
    const filter = filterByJahrgangAccess(req('teamer', [JG_EIGEN]));
    expect(filter.where).toBe('WHERE organization_id = $1 AND jahrgang_id IN ($2)');
    expect(filter.params).toEqual([1, 10]);
  });
});
