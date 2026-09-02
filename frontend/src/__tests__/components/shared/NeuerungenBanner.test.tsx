import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NeuerungenBanner from '../../../components/shared/NeuerungenBanner';

const UPDATE = 'Was ist neu in Version 2.1? Die Neuerungen ansehen';
const MITMACHEN = 'Events und Aktivitäten: So funktioniert der Mitmachen-Tab';

describe('NeuerungenBanner', () => {
  it('zeigt beide Banner im selben Look', () => {
    // Der Kern des Nutzerhinweises vom 25.08.2026: rosa "Was ist neu?" und
    // gruen "Events und Aktivitaeten" sollen ueberall 1:1 gleich aussehen.
    render(
      <NeuerungenBanner onUpdateOeffnen={vi.fn()} onMitmachenOeffnen={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: UPDATE })).toHaveClass('app-whatsnew');
    const gruen = screen.getByRole('button', { name: MITMACHEN });
    expect(gruen).toHaveClass('app-whatsnew');
    expect(gruen).toHaveClass('app-whatsnew--mitmachen');
  });

  describe('im Profil und unter "Mehr" (dauerhaft)', () => {
    it('haben beide KEIN X zum Wegklicken', () => {
      render(
        <NeuerungenBanner onUpdateOeffnen={vi.fn()} onMitmachenOeffnen={vi.fn()} />
      );
      expect(screen.queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull();
    });

    it('oeffnen beide ihre Erklaerung', () => {
      const onUpdateOeffnen = vi.fn();
      const onMitmachenOeffnen = vi.fn();
      render(
        <NeuerungenBanner
          onUpdateOeffnen={onUpdateOeffnen}
          onMitmachenOeffnen={onMitmachenOeffnen}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: UPDATE }));
      fireEvent.click(screen.getByRole('button', { name: MITMACHEN }));
      expect(onUpdateOeffnen).toHaveBeenCalledTimes(1);
      expect(onMitmachenOeffnen).toHaveBeenCalledTimes(1);
    });
  });

  describe('auf der Startseite (wegklickbar)', () => {
    const aufbau = () => {
      const p = {
        onUpdateOeffnen: vi.fn(),
        onMitmachenOeffnen: vi.fn(),
        onUpdateAusblenden: vi.fn(),
        onMitmachenAusblenden: vi.fn(),
      };
      render(<NeuerungenBanner {...p} />);
      return p;
    };

    it('hat jeder Banner sein eigenes X', () => {
      aufbau();
      expect(screen.getAllByRole('button', { name: 'Hinweis ausblenden' })).toHaveLength(2);
    });

    it('blendet das X nur den einen Banner aus, ohne zu oeffnen', () => {
      const p = aufbau();
      const [xUpdate] = screen.getAllByRole('button', { name: 'Hinweis ausblenden' });
      fireEvent.click(xUpdate);
      expect(p.onUpdateAusblenden).toHaveBeenCalledTimes(1);
      expect(p.onMitmachenAusblenden).toHaveBeenCalledTimes(0);
      expect(p.onUpdateOeffnen).toHaveBeenCalledTimes(0);
    });
  });

  it('blendet einzelne Banner aus, wenn sie als gesehen gelten', () => {
    // Auf der Startseite steuern die Flags, welcher Banner noch steht.
    render(
      <NeuerungenBanner
        onUpdateOeffnen={vi.fn()}
        onMitmachenOeffnen={vi.fn()}
        updateSichtbar={false}
        mitmachenSichtbar={true}
      />
    );
    expect(screen.queryByRole('button', { name: UPDATE })).toBeNull();
    expect(screen.getByRole('button', { name: MITMACHEN })).toBeInTheDocument();
  });
});
