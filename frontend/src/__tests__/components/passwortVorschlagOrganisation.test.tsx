import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Beim Anlegen einer Organisation wird ein erstes Leitungs-Konto mit Passwort
// vergeben. Denselben Knopf wie beim Zuruecksetzen eines Passworts
// ("Sicheres Passwort vorschlagen") muss es auch hier geben — sonst tippt
// jemand von Hand etwas, das die Policy des Servers ablehnt.
//
// IonInput-Werte sind in jsdom nicht auslesbar (Ionic hydriert das Shadow DOM
// dort nicht; value und type melden konstant Standardwerte, und
// ionInput-Ereignisse erreichen React nicht). Die Zusicherungen gehen deshalb
// zweigleisig: Die Regeln des Generators pruefen echte Laeufe, die Verdrahtung
// im Modal prueft ein Spion auf genau der Funktion, die den Wert liefert.

const mockGenerate = vi.fn();
vi.mock('../../utils/passwortVorschlag', async () => {
  const echt = await vi.importActual<typeof import('../../utils/passwortVorschlag')>(
    '../../utils/passwortVorschlag'
  );
  return {
    ...echt,
    generateStrongPassword: (...a: unknown[]) => {
      const pw = echt.generateStrongPassword(...(a as [number?]));
      mockGenerate(pw);
      return pw;
    },
  };
});

import {
  generateStrongPassword,
  PASSWORT_GROSS,
  PASSWORT_KLEIN,
  PASSWORT_ZIFFERN,
  PASSWORT_SONDER,
} from '../../utils/passwortVorschlag';

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setError: vi.fn(),
    setSuccess: vi.fn(),
    isOnline: true,
    user: { id: 1, role_name: 'super_admin', is_super_admin: true },
  }),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));

import OrganizationManagementModal from '../../components/admin/modals/OrganizationManagementModal';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const MODAL = 'src/components/admin/modals/OrganizationManagementModal.tsx';

// Genau die Policy, die handleSave im Modal prueft (und die der Server erzwingt)
const erfuelltPolicy = (pw: string) =>
  pw.length >= 8 &&
  !/\s/.test(pw) &&
  /[A-Z]/.test(pw) &&
  /[a-z]/.test(pw) &&
  /[0-9]/.test(pw) &&
  /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`]/.test(pw);

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Passwort-Vorschlag: die Regeln des Generators', () => {
  it('erzeugt 14 Zeichen aus dem vorgesehenen Zeichenvorrat', () => {
    const pw = generateStrongPassword();
    expect(pw).toHaveLength(14);
    const erlaubt = PASSWORT_GROSS + PASSWORT_KLEIN + PASSWORT_ZIFFERN + PASSWORT_SONDER;
    for (const zeichen of pw) {
      expect(erlaubt).toContain(zeichen);
    }
  });

  it('enthaelt aus jeder Zeichenklasse mindestens ein Zeichen — 200 Laeufe', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateStrongPassword().split('');
      expect(pw.some(c => PASSWORT_GROSS.includes(c))).toBe(true);
      expect(pw.some(c => PASSWORT_KLEIN.includes(c))).toBe(true);
      expect(pw.some(c => PASSWORT_ZIFFERN.includes(c))).toBe(true);
      expect(pw.some(c => PASSWORT_SONDER.includes(c))).toBe(true);
    }
  });

  it('meidet verwechselbare Zeichen (I O l o 0 1) — 200 Laeufe', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateStrongPassword()).not.toMatch(/[IOlo01]/);
    }
  });

  it('besteht die Validierung, die das Formular selbst anlegt — 200 Laeufe', () => {
    for (let i = 0; i < 200; i++) {
      expect(erfuelltPolicy(generateStrongPassword())).toBe(true);
    }
  });

  it('liefert bei 100 Aufrufen 100 verschiedene Passwoerter', () => {
    const gesehen = new Set<string>();
    for (let i = 0; i < 100; i++) gesehen.add(generateStrongPassword());
    expect(gesehen.size).toBe(100);
  });
});

describe('Organisation anlegen: der Knopf', () => {
  const rendern = () => render(<OrganizationManagementModal onClose={vi.fn()} onSuccess={vi.fn()} />);

  // Ionic hydriert in jsdom langsam — unter Last (volle Suite) reicht die
  // Standard-Wartezeit von 1 s nicht. Deshalb ueberall grosszuegig warten.
  const knopfFinden = () =>
    screen.findByText('Sicheres Passwort vorschlagen', undefined, { timeout: 15000 });

  it('ist beim Anlegen einer Organisation vorhanden — mit demselben Wortlaut', async () => {
    rendern();
    expect(await knopfFinden()).toBeInTheDocument();
  }, 20000);

  it('ein Klick erzeugt ein Passwort, das die Validierung des Formulars besteht', async () => {
    rendern();
    const knopf = await knopfFinden();
    expect(mockGenerate).not.toHaveBeenCalled();

    fireEvent.click(knopf);

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const pw = mockGenerate.mock.calls[0][0] as string;
    expect(pw).toHaveLength(14);
    expect(erfuelltPolicy(pw)).toBe(true);
  }, 20000);

  it('zweimal klicken erzeugt zwei verschiedene Passwoerter', async () => {
    rendern();
    const knopf = await knopfFinden();

    fireEvent.click(knopf);
    fireEvent.click(knopf);

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(2), { timeout: 5000 });
    const erstes = mockGenerate.mock.calls[0][0] as string;
    const zweites = mockGenerate.mock.calls[1][0] as string;
    expect(zweites).not.toBe(erstes);
    expect(erfuelltPolicy(zweites)).toBe(true);
  }, 20000);

  it('hat einen Augen-Knopf, damit der Vorschlag lesbar ist', async () => {
    rendern();
    const knopf = await knopfFinden();
    // Ionic setzt aria-label erst beim naechsten Rendern des Knopfs.
    fireEvent.click(knopf);
    await waitFor(
      () =>
        expect(
          document.body.querySelector('[aria-label="Passwort anzeigen oder verbergen"]')
        ).not.toBeNull(),
      { timeout: 10000 }
    );
  }, 25000);

  // Der Klick-Test oben belegt, DASS der Generator laeuft. Dass sein Ergebnis
  // auch im Formularfeld landet und sichtbar wird, laesst sich in jsdom nicht
  // beobachten (Ionic-Shadow-DOM) — deshalb hier am Quelltext festgehalten.
  it('schreibt den Vorschlag in das Passwortfeld und macht es sichtbar', () => {
    const quelle = lies(MODAL);
    expect(quelle).toContain('admin_password: generateStrongPassword()');
    expect(quelle).toContain('setShowAdminPassword(true)');
    expect(quelle).toContain("type={showAdminPassword ? 'text' : 'password'}");
  });
});

describe('Nur eine Fassung des Generators', () => {
  it('das Zuruecksetzen-Modal nutzt dieselbe Funktion statt einer Kopie', () => {
    const quelle = lies('src/components/admin/modals/AdminPasswordResetModal.tsx');
    expect(quelle).toContain("from '../../../utils/passwortVorschlag'");
    // Keine zweite Inline-Fassung mehr
    expect(quelle).not.toContain('crypto.getRandomValues');
  });

  it('das Organisations-Modal nutzt dieselbe Funktion statt einer Kopie', () => {
    const quelle = lies(MODAL);
    expect(quelle).toContain("from '../../../utils/passwortVorschlag'");
    expect(quelle).not.toContain('crypto.getRandomValues');
  });
});
