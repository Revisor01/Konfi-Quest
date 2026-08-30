import { describe, it, expect } from 'vitest';
import type { KonfiFormDaten } from '../../types/user';

// Befund 30.08.2026: Nach dem Anlegen einer Konfi stand im Passwort-Dialog
// `Konfi "undefined" erstellt.` statt des eingegebenen Namens.
//
// Ursache: Der Dialog las `konfiData.display_name`. Das Formular (KonfiModal)
// schickt aber `{ name, jahrgang_id }`, und das Backend liest ebenfalls
// `const { name, jahrgang_id } = req.body` (konfi-management.js:154).
// `display_name` gab es in diesem Objekt nie -- die Zeichenkette wurde
// stillschweigend zu "undefined".

const formularDaten: KonfiFormDaten = {
  name: 'Emilia Musterfrau',
  jahrgang_id: 3,
};

const meldung = (k: KonfiFormDaten) => `Konfi "${k.name}" erstellt.`;
// FALSCH (bis 30.08.2026)
const alteMeldung = (k: KonfiFormDaten) =>
  `Konfi "${(k as unknown as { display_name?: string }).display_name}" erstellt.`;

describe('Konfi angelegt: Bestaetigungstext', () => {
  it('nennt den eingegebenen Namen', () => {
    expect(meldung(formularDaten)).toBe('Konfi "Emilia Musterfrau" erstellt.');
  });

  it('schrieb mit dem alten Feldnamen woertlich "undefined"', () => {
    expect(alteMeldung(formularDaten)).toBe('Konfi "undefined" erstellt.');
  });

  // Das Formular schickt genau diese zwei Felder -- kein display_name.
  it('das Formular kennt nur name und jahrgang_id', () => {
    expect(Object.keys(formularDaten).sort()).toEqual(['jahrgang_id', 'name']);
  });

  it('beim zweiten Anlauf nach der Limit-Rueckfrage kommt confirm dazu', () => {
    const mitBestaetigung: KonfiFormDaten = { ...formularDaten, confirm: true };
    expect(mitBestaetigung.confirm).toBe(true);
    expect(meldung(mitBestaetigung)).toBe('Konfi "Emilia Musterfrau" erstellt.');
  });
});
