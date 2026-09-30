import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MedienPlatzhalter from '../../../components/shared/MedienPlatzhalter';
import type { MedienZustand } from '../../../hooks/useMedienDatei';

// Was an der Stelle eines Bildes, Videos oder einer Aufnahme steht, solange es
// nicht da ist -- im Chat wie in den Challenges gleich (Audit Tests
// 26.09.2026, BF-10: ohne Test). Gerendert mit dem echten Ionic.

const zeige = (zustand: MedienZustand, prozent: number | null = null, was = 'Das Bild') => {
  const onErneut = vi.fn();
  const r = render(<MedienPlatzhalter zustand={zustand} prozent={prozent} was={was} onErneut={onErneut} />);
  return { onErneut, ...r };
};
const erneutKnopf = (c: HTMLElement) =>
  [...c.querySelectorAll('ion-button')].find((k) => k.textContent === 'Erneut versuchen') as HTMLElement | undefined;

describe('MedienPlatzhalter', () => {
  it('lädt mit bekannter Größe: Text mit Prozent und ein benannter Balken', () => {
    zeige('laedt', 40, 'Das Video');
    expect(screen.getByText('Wird geladen… 40 %')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Das Video wird geladen: 40 Prozent');
  });

  it('lädt ohne bekannte Größe: nur der Text, kein geratener Balken', () => {
    zeige('laedt', null);
    expect(screen.getByText('Wird geladen…')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('noch nicht angestoßen (wartet) sieht aus wie Laden', () => {
    zeige('wartet', null);
    expect(screen.getByText('Wird geladen…')).toBeInTheDocument();
  });

  it('ohne Netz: die graue Offline-Zeile statt einer Ladeanzeige, kein zweiter Versuch', () => {
    const { container } = zeige('offline', 40);
    expect(screen.getByText('Das Bild ist offline nicht verfügbar.')).toBeInTheDocument();
    expect(container.querySelector('.app-offline-platzhalter')).not.toBeNull();
    expect(screen.queryByText(/Wird geladen/)).toBeNull();
    expect(erneutKnopf(container)).toBeUndefined();
  });

  it('gelöscht oder kein Zugriff: "nicht mehr verfügbar", ohne zweiten Versuch', () => {
    const { container } = zeige('weg', null, 'Das Video');
    expect(screen.getByText('Das Video ist nicht mehr verfügbar.')).toBeInTheDocument();
    expect(erneutKnopf(container)).toBeUndefined();
  });

  it('Fehler: ein Satz und "Erneut versuchen", der den zweiten Versuch startet', () => {
    const { container, onErneut } = zeige('fehler', null, 'Die Aufnahme');
    expect(screen.getByText('Die Aufnahme konnte nicht geladen werden.')).toBeInTheDocument();
    fireEvent.click(erneutKnopf(container)!);
    expect(onErneut).toHaveBeenCalledTimes(1);
  });

  it('der Tipp auf "Erneut versuchen" öffnet nicht die umgebende Karte oder Sprechblase', () => {
    const onKarte = vi.fn();
    const onErneut = vi.fn();
    const { container } = render(
      <div onClick={onKarte}>
        <MedienPlatzhalter zustand="fehler" prozent={null} was="Das Bild" onErneut={onErneut} />
      </div>
    );
    fireEvent.click(erneutKnopf(container)!);
    expect(onErneut).toHaveBeenCalledTimes(1);
    expect(onKarte).toHaveBeenCalledTimes(0);
  });
});
