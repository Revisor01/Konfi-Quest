import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { KONTO_MODAL_STIL } from '../../components/shared/ChangeEmailModal';

// E-Mail- und Passwort-Modal lagen bis zur Vereinheitlichung DOPPELT vor
// (admin/modals und konfi/modals, das Teamer-Profil importierte quer aus dem
// Konfi-Baum) — funktional identisch, nur die CSS-Klassen unterschieden sich.
// Diese Tests sichern ab, dass alle drei Profil-Ansichten dieselbe geteilte
// Komponente nutzen und keine neue Kopie entsteht (Muster wie
// biometrieAlleDreiAnsichten.test.ts).

const profilSeiten: { rolle: string; datei: string; variante: string }[] = [
  {
    rolle: 'Leitung',
    datei: 'src/components/admin/pages/AdminProfilePage.tsx',
    variante: 'users',
  },
  {
    rolle: 'Teamer:innen',
    datei: 'src/components/teamer/pages/TeamerProfilePage.tsx',
    variante: 'teamer',
  },
  {
    rolle: 'Konfis',
    datei: 'src/components/konfi/views/ProfileView.tsx',
    variante: 'purple',
  },
];

const lies = (datei: string) =>
  readFileSync(resolve(process.cwd(), datei), 'utf-8');

describe('Konto-Modale (E-Mail + Passwort) in allen drei Ansichten', () => {
  profilSeiten.forEach(({ rolle, datei, variante }) => {
    it(`Ansicht der ${rolle} nutzt die geteilten Modale mit variante "${variante}"`, () => {
      const inhalt = lies(datei);
      expect(inhalt).toContain("/shared/ChangeEmailModal'");
      expect(inhalt).toContain("/shared/ChangePasswordModal'");
      // Beide Modale geben die Rollenfarbe über die variante-Prop mit.
      const varianten = inhalt.match(new RegExp(`variante: '${variante}'`, 'g')) || [];
      expect(varianten.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('die alten Kopien in admin/ und konfi/ existieren nicht mehr', () => {
    const alteKopien = [
      'src/components/admin/modals/ChangeEmailModal.tsx',
      'src/components/admin/modals/ChangePasswordModal.tsx',
      'src/components/konfi/modals/ChangeEmailModal.tsx',
      'src/components/konfi/modals/ChangePasswordModal.tsx',
    ];
    alteKopien.forEach((datei) => {
      expect(existsSync(resolve(process.cwd(), datei))).toBe(false);
    });
  });

  it('kein Import zeigt mehr auf modals/ChangeEmailModal oder modals/ChangePasswordModal', () => {
    profilSeiten.forEach(({ datei }) => {
      const inhalt = lies(datei);
      expect(inhalt).not.toContain("modals/ChangeEmailModal'");
      expect(inhalt).not.toContain("modals/ChangePasswordModal'");
    });
  });

  it('die Stil-Tabelle bildet die Klassen der frueheren Kopien exakt ab', () => {
    // Leitung: vorher hart kodiert in admin/modals/*
    expect(KONTO_MODAL_STIL.users).toEqual({
      sectionIcon: 'app-section-icon--users',
      submitBtn: 'app-modal-submit-btn--settings',
      infoBox: 'app-info-box--blue',
    });
    // Teamer:innen: vorher als Klassen-Props im TeamerProfilePage-Aufruf
    expect(KONTO_MODAL_STIL.teamer).toEqual({
      sectionIcon: 'app-section-icon--teamer',
      submitBtn: 'app-modal-submit-btn--teamer',
      infoBox: 'app-info-box--teamer',
    });
    // Konfis: vorher Default der konfi/modals-Kopien
    expect(KONTO_MODAL_STIL.purple).toEqual({
      sectionIcon: 'app-section-icon--purple',
      submitBtn: 'app-modal-submit-btn--konfi',
      infoBox: 'app-info-box--purple',
    });
  });
});
