import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hinweis beim Konfi-Anlegen (Audit Screens Leitung BF-05, 26.09.2026).
//
// Der Hinweis versprach: "Du kannst das Passwort später in der Detailansicht
// einsehen oder zurücksetzen." Das stimmt nicht. Das Passwort wird gehasht
// gespeichert (backend/routes/konfi-management.js, bcrypt) und genau einmal
// angezeigt -- im Dialog "Einmalpasswort" direkt nach dem Anlegen
// (AdminKonfisPage). Die Detailansicht kann nur ein NEUES erzeugen
// (POST /admin/konfis/:id/regenerate-password). Wer dem Hinweis traute,
// tippte den Dialog weg, ohne zu kopieren.
// ---------------------------------------------------------------------------

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: true }),
}));

import KonfiModal from '../../components/admin/modals/KonfiModal';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

afterEach(() => cleanup());

describe('Konfi anlegen: der Hinweis zum Passwort stimmt', () => {
  it('verspricht nicht, das Passwort später einsehen zu können', () => {
    const { container } = render(<KonfiModal jahrgaenge={[]} onClose={vi.fn()} onSave={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Benutzername und Passwort werden automatisch generiert.');
    expect(text).not.toMatch(/später in der Detailansicht einsehen/);
  });

  it('sagt, was die App tut: einmal anzeigen, danach nur ein neues erzeugen', () => {
    const { container } = render(<KonfiModal jahrgaenge={[]} onClose={vi.fn()} onSave={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Das Passwort wird dir nach dem Anlegen einmal angezeigt');
    expect(text).toContain('in der Detailansicht kannst du nur ein neues erzeugen');
  });

  it('das Verhalten, das der Hinweis beschreibt, gibt es so', () => {
    // Einmal angezeigt: der Dialog nach dem Anlegen mit Kopieren-Knopf.
    const liste = lies('src/components/admin/pages/AdminKonfisPage.tsx');
    expect(liste).toContain('const tempPassword = response.data.temporaryPassword;');
    expect(liste).toContain("header: 'Einmalpasswort'");
    // Danach nur neu erzeugen: die Detailansicht ruft regenerate-password,
    // eine Route, die ein bestehendes Passwort liefert, gibt es nicht.
    const detail = lies('src/components/admin/views/KonfiDetailView.tsx');
    expect(detail).toContain('/regenerate-password`');
    expect(detail).not.toMatch(/api\.get\([^)]*password/i);
  });

  it('beim Bearbeiten erscheint der Hinweis nicht', () => {
    const { container } = render(
      <KonfiModal
        jahrgaenge={[{ id: 2, name: '2026/27' }]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        konfi={{ id: 5, display_name: 'Kim', jahrgang_id: 2 }}
      />
    );
    expect(container.textContent ?? '').not.toContain('Passwort');
  });
});
