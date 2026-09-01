import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Jahrgaenge anlegen darf seit dem 01.09.2026 NUR der Org-Admin (Simons
// Entscheidung, woertlich: "Admin darf keine Jahrgänge anlegen. Das darf nur
// org Admin. Der weist dann direkt zu."). Das Backend antwortet einem Admin
// mit 403 — die Oberflaeche darf ihm den Anlege-Knopf deshalb gar nicht erst
// anbieten, sonst steht dort eine Aktion, die immer scheitert.
//
// Als Dateitest (Muster: konfiStammdatenBearbeiten.test.ts), weil der Fehler
// waere, dass die Rechte-Zeile beim Umbauen der Seite still wieder auf
// "alle Admins" zurueckfaellt.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const seite = lies('src/components/admin/pages/AdminJahrgaengeePage.tsx');

describe('Jahrgang anlegen: nur Org-Admin', () => {
  it('der Anlege-Knopf haengt an der Rolle org_admin, nicht an isAdmin', () => {
    expect(seite).toContain("const canCreate = user?.role_name === 'org_admin'");
  });

  it('Bearbeiten und Loeschen bleiben fuer Admins moeglich (jahrgangsgebunden)', () => {
    expect(seite).toContain('const canEdit = isAdmin');
    expect(seite).toContain('const canDelete = isAdmin');
  });
});

describe('Direkt-Zuweisung beim Anlegen', () => {
  it('die Auswahl bietet nur Admins und Teamer:innen an', () => {
    // Org-Admins sehen ohnehin alle Jahrgaenge, Konfis GEHOEREN zu einem
    // Jahrgang statt ihm zugewiesen zu werden.
    expect(seite).toContain("p.role_name === 'admin' || p.role_name === 'teamer'");
  });

  it('user_assignments wird nur beim Anlegen und nur mit Auswahl gesendet', () => {
    // Ohne Auswahl bleibt das Feld weg — der Server verhaelt sich dann exakt
    // wie vor der Aenderung (Vertrag mit ausgelieferten Apps).
    expect(seite).toContain('if (!jahrgang && zugewieseneIds.length > 0)');
  });

  it('die Zuweisung vergibt view+edit — wie die Benutzerverwaltung', () => {
    expect(seite).toContain('can_view: true');
    expect(seite).toContain('can_edit: true');
  });

  it('der Zuweisungs-Abschnitt erscheint nur im Anlege-Modus fuer den Org-Admin', () => {
    expect(seite).toContain("!jahrgang && user?.role_name === 'org_admin' && zuweisbare.length > 0");
  });
});
