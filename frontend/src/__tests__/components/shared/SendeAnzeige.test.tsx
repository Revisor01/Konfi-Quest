import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SendeAnzeige from '../../../components/shared/SendeAnzeige';

// Die Anzeige beim Hochladen (Challenge-Beitrag, Nachweisfoto, Material):
// "Wird gesendet… 40 %" mit Balken, bei 100 % "Wird verarbeitet…"
// (Audit Tests 26.09.2026, BF-10: ohne Test). Gerendert, nicht gelesen.

describe('SendeAnzeige', () => {
  it('bei 0 % steht nichts da', () => {
    const { container } = render(<SendeAnzeige prozent={0} was="Beitrag" farbe="red" />);
    expect(container.innerHTML).toBe('');
  });

  it('Grenzfall: ein negativer Wert zeigt ebenfalls nichts', () => {
    const { container } = render(<SendeAnzeige prozent={-5} was="Beitrag" farbe="red" />);
    expect(container.innerHTML).toBe('');
  });

  it('unterwegs: Text mit Prozent und ein benannter Balken', () => {
    render(<SendeAnzeige prozent={40} was="Beitrag" farbe="red" />);
    expect(screen.getByText('Wird gesendet… 40 %')).toBeInTheDocument();
    const balken = screen.getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('40');
    expect(balken.getAttribute('aria-label')).toBe('Beitrag wird gesendet: 40 Prozent');
  });

  it('die Beschriftung nennt, was gesendet wird', () => {
    render(<SendeAnzeige prozent={7} was="Foto" farbe="red" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Foto wird gesendet: 7 Prozent');
  });

  it('bei 100 % rechnet der Server: "Wird verarbeitet…" statt eines stehenden Balkens', () => {
    render(<SendeAnzeige prozent={100} was="Beitrag" farbe="red" />);
    expect(screen.getByText('Wird verarbeitet…')).toBeInTheDocument();
    expect(screen.queryByText(/Wird gesendet/)).toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('ist eine höfliche Live-Region und färbt den Balken in der übergebenen Farbe', () => {
    render(<SendeAnzeige prozent={40} was="Beitrag" farbe="rgb(10, 20, 30)" />);
    const balken = screen.getByRole('progressbar');
    expect(balken.parentElement!.style.color).toBe('rgb(10, 20, 30)');
    expect(balken.parentElement!.parentElement!.getAttribute('aria-live')).toBe('polite');
  });
});
