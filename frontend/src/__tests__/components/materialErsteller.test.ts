import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { darfMaterialBearbeiten } from '../../utils/materialRechte';

// BEARBEITEN NUR DURCH DIE ERSTELLENDE PERSON (Entscheidung Simon, 01.09.2026)
//
//   "Admins sehen Material ihrer Jahrgaenge und globales Material.
//    Material bearbeiten kann nur der Ersteller!"
//
// Die verbindliche Pruefung macht der Server (403). Diese Tests halten fest,
// dass die Oberflaeche den Unterschied ZEIGT, statt Knoepfe anzubieten, die
// mit 403 enden: Der Loeschen-Wisch erscheint nur bei der erstellenden
// Person (oder der Leitung), das Formular oeffnet sonst schreibgeschuetzt.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const leitungsListe = lies('src/components/admin/pages/AdminMaterialPage.tsx');
const formular = lies('src/components/admin/modals/MaterialFormModal.tsx');

describe('darfMaterialBearbeiten (Spiegel der Server-Regel)', () => {
  const ersteller = { id: 4, role_name: 'admin' };
  const andererAdmin = { id: 7, role_name: 'admin' };
  const leitung = { id: 5, role_name: 'org_admin' };
  const superFlag = { id: 8, role_name: 'admin', is_super_admin: true };

  it('die erstellende Person darf ihr Material bearbeiten', () => {
    expect(darfMaterialBearbeiten(ersteller, { created_by: 4 })).toBe(true);
  });

  it('ein anderer Admin derselben Gemeinde darf NICHT', () => {
    expect(darfMaterialBearbeiten(andererAdmin, { created_by: 4 })).toBe(false);
  });

  it('org_admin darf fremdes Material bearbeiten', () => {
    expect(darfMaterialBearbeiten(leitung, { created_by: 4 })).toBe(true);
  });

  it('das is_super_admin-Flag zaehlt wie org_admin', () => {
    expect(darfMaterialBearbeiten(superFlag, { created_by: 4 })).toBe(true);
  });

  it('created_by null (Konto geloescht): nur noch die Leitung', () => {
    expect(darfMaterialBearbeiten(andererAdmin, { created_by: null })).toBe(false);
    expect(darfMaterialBearbeiten(leitung, { created_by: null })).toBe(true);
  });

  it('created_by fehlt (alter Offline-Cache): wie null behandeln', () => {
    expect(darfMaterialBearbeiten(andererAdmin, {})).toBe(false);
    expect(darfMaterialBearbeiten(leitung, {})).toBe(true);
  });

  it('ohne angemeldete Person darf niemand', () => {
    expect(darfMaterialBearbeiten(null, { created_by: 4 })).toBe(false);
  });
});

describe('Leitungsliste: Loeschen nur fuer die erstellende Person', () => {
  it('der Loeschen-Wisch haengt an darfMaterialBearbeiten', () => {
    expect(leitungsListe).toContain('darfMaterialBearbeiten(user, mat) && (');
  });

  it('das Formular bekommt den Schreibschutz mitgegeben', () => {
    expect(leitungsListe).toContain('nurLesen: editMaterial ? !darfMaterialBearbeiten(user, editMaterial) : false');
  });
});

describe('Formular: Schreibschutz ohne Bearbeitungsrecht', () => {
  it('ohne Recht gibt es keinen Speichern-Knopf', () => {
    expect(formular).toContain('{!nurLesen && (');
    expect(formular).toContain('aria-label="Material speichern"');
  });

  it('handleSave hat den doppelten Boden', () => {
    expect(formular).toContain('if (nurLesen) return;');
  });

  it('der Titel wechselt auf "Material ansehen"', () => {
    expect(formular).toContain("nurLesen ? 'Material ansehen'");
  });

  it('der Hinweis nennt die erstellende Person', () => {
    expect(formular).toContain('Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.');
    expect(formular).toContain('Bearbeiten und löschen kann nur noch die Gemeindeleitung.');
  });

  it('Datei-Upload und Datei-Loeschen fehlen im Lese-Modus', () => {
    expect(formular).toContain("art === 'datei' && !nurLesen && (");
    expect(formular).toContain('aria-label="Datei löschen"');
  });
});
