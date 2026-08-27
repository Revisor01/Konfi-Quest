import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 16 aus dem Rollen-Bericht (26.08.2026): Die Route /admin/users ist
// ungegatet (MainTabs.tsx), der UI-Einstieg aber org_admin-exklusiv
// (AdminSettingsPage.tsx). Ein admin, der die Adresse kennt, landete auf der
// Seite und sah dort Loesch-Wische, die allein an `can_edit` hingen -- ohne
// Rollen-Gate. Angetippt liefen sie in einen 403 (users.js:385,
// requireOrgAdmin).
//
// Der Anlegen-Knopf prueft die Rolle seit jeher (AdminUsersPage.tsx:121), die
// Liste darunter nicht. Genau diese halbe Absicherung ist der Befund.
//
// Serverseitig war es nie eine Luecke -- requireOrgAdmin haelt. Es ging um
// Aktionen, die sichtbar sind und dann scheitern.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const seite = lies('src/components/admin/pages/AdminUsersPage.tsx');
const liste = lies('src/components/admin/UsersView.tsx');

describe('Benutzerseite: Rollen-Gate auch in der Liste (Rollen-Bericht 16)', () => {
  it('die Seite reicht die Berechtigung an die Liste durch', () => {
    expect(seite).toContain("darfVerwalten={user?.role_name === 'org_admin'}");
  });

  it('der Loesch-Wisch prueft die Rolle, nicht nur can_edit', () => {
    expect(liste).toContain('{darfVerwalten && user.can_edit !== false && (');
  });

  it('can_edit bleibt zusaetzlich erhalten', () => {
    // Gegenprobe: Das Rollen-Gate ersetzt die bestehende Pruefung nicht,
    // es kommt davor. Ein org_admin darf nicht plötzlich Zeilen loeschen,
    // die can_edit=false tragen.
    const zweig = liste.slice(
      liste.indexOf('{darfVerwalten && user.can_edit'),
      liste.indexOf('{darfVerwalten && user.can_edit') + 80
    );
    expect(zweig).toContain('user.can_edit !== false');
  });

  it('der Anlegen-Knopf bleibt gegatet', () => {
    // Gegenprobe: Die schon vorhandene Haelfte der Absicherung darf beim
    // Nachziehen der anderen nicht verloren gehen.
    expect(seite).toContain("user?.role_name === 'org_admin' && (");
  });
});
