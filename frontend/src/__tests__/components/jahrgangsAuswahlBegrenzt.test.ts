import { describe, it, expect } from 'vitest';

// Befund 01.09.2026: Seit die Jahrgangs-Zuweisung an die Rollenhierarchie
// gebunden ist (Simons Regel: ein Admin ist an SEINE Jahrgaenge gebunden,
// ausser bei Teamer:innen), weist das Backend einen Admin ab, der eine
// Person einem fremden Jahrgang zuordnen will -- 403 mit
// "Kein Zugriff auf diesen Jahrgang".
//
// Der Dialog bot ihm die fremden Jahrgaenge aber weiterhin zum Ankreuzen an
// (UserManagementModal lud GET /admin/jahrgaenge, also ALLE der Gemeinde).
// Der Fehlertext erschien korrekt und nichts stuerzte ab -- aber man klickt
// etwas an, das nicht gehen kann. Das Angebot muss zur Berechtigung passen.
//
// Vorbild ist KonfiDetailView.tsx:324: dort wird `eigeneJahrgangIds` schon
// so hergeleitet.

type Jahrgang = { id: number; name: string };
type Nutzer = {
  role_name?: string;
  assigned_jahrgaenge?: { id: number; name: string; can_view?: boolean; can_edit?: boolean }[];
};

const alleJahrgaenge: Jahrgang[] = [
  { id: 1, name: '2025/26' },
  { id: 2, name: '2026/27' },
  { id: 3, name: '2027/28' },
];

// Die Regel, wie sie im Dialog steht.
const auswaehlbareJahrgaenge = (alle: Jahrgang[], nutzer?: Nutzer): Jahrgang[] => {
  if (nutzer?.role_name !== 'admin') return alle;
  const eigene = new Set(
    (nutzer.assigned_jahrgaenge || []).filter(j => j.can_view !== false).map(j => j.id)
  );
  return alle.filter(j => eigene.has(j.id));
};

describe('Jahrgangs-Auswahl im Benutzer-Dialog', () => {
  it('ein Admin sieht nur seine eigenen Jahrgaenge', () => {
    const admin: Nutzer = {
      role_name: 'admin',
      assigned_jahrgaenge: [{ id: 2, name: '2026/27', can_view: true }],
    };
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, admin).map(j => j.id)).toEqual([2]);
  });

  it('ein Admin mit mehreren Jahrgaengen sieht alle seine', () => {
    const admin: Nutzer = {
      role_name: 'admin',
      assigned_jahrgaenge: [
        { id: 1, name: '2025/26', can_view: true },
        { id: 3, name: '2027/28', can_view: true },
      ],
    };
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, admin).map(j => j.id)).toEqual([1, 3]);
  });

  it('die Gemeindeleitung sieht weiterhin ALLE Jahrgaenge', () => {
    // org_admin ist von der Jahrgangs-Bindung ausgenommen -- eine
    // Einschraenkung waere dort schlicht falsch.
    const orgAdmin: Nutzer = { role_name: 'org_admin', assigned_jahrgaenge: [] };
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, orgAdmin).map(j => j.id)).toEqual([1, 2, 3]);
  });

  it('ein Admin OHNE Zuweisung bekommt eine leere Auswahl, nicht alle', () => {
    // Das ist ein gueltiger Fall (Simon 31.08.2026: ein Admin, der nur mit
    // den Teamer:innen spricht, braucht keinen Jahrgang). Er darf dann aber
    // auch niemanden zuordnen -- die leere Liste ist ehrlicher als eine, aus
    // der jede Wahl in ein 403 laeuft.
    const admin: Nutzer = { role_name: 'admin', assigned_jahrgaenge: [] };
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, admin)).toEqual([]);
  });

  it('ein Jahrgang ohne Lesezugriff zaehlt nicht als eigener', () => {
    const admin: Nutzer = {
      role_name: 'admin',
      assigned_jahrgaenge: [{ id: 2, name: '2026/27', can_view: false }],
    };
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, admin)).toEqual([]);
  });

  it('so sah es vorher aus: ein Admin bekam ALLE angeboten', () => {
    const admin: Nutzer = {
      role_name: 'admin',
      assigned_jahrgaenge: [{ id: 2, name: '2026/27', can_view: true }],
    };
    // Die alte Fassung reichte die Backend-Liste ungefiltert durch.
    expect(alleJahrgaenge.map(j => j.id)).toEqual([1, 2, 3]);
    expect(auswaehlbareJahrgaenge(alleJahrgaenge, admin).length).toBeLessThan(alleJahrgaenge.length);
  });
});
