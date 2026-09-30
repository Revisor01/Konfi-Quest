import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LadeStandZeile from '../../../components/shared/LadeStandZeile';

// Die Meta-Zeile einer Datei in einer Liste (Material): sonst ihre Größe,
// beim Laden "Wird geladen… 40 %" mit Balken (Audit Tests 26.09.2026, BF-10:
// ohne Test). Gerendert, nicht gelesen.

const zeile = (props: Partial<React.ComponentProps<typeof LadeStandZeile>> = {}) =>
  render(<LadeStandZeile laedt={false} prozent={null} sonst="2,4 MB" farbe="rgb(1, 2, 3)" {...props} />);

describe('LadeStandZeile', () => {
  it('ruhend: zeigt die Größe, keinen Balken und keine Live-Region', () => {
    const { container } = zeile();
    expect(screen.getByText('2,4 MB')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('lädt mit bekannter Größe: Text mit Prozent statt der Größe, Balken mit Beschriftung', () => {
    zeile({ laedt: true, prozent: 40 });
    expect(screen.getByText('Wird geladen… 40 %')).toBeInTheDocument();
    expect(screen.queryByText('2,4 MB')).toBeNull();

    const balken = screen.getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('40');
    expect(balken.getAttribute('aria-label')).toBe('Datei wird geladen: 40 Prozent');
  });

  it('lädt: die Zeile wird Vorlesehilfen höflich angesagt', () => {
    zeile({ laedt: true, prozent: 40 });
    expect(screen.getByText('Wird geladen… 40 %').getAttribute('aria-live')).toBe('polite');
  });

  it('lädt ohne bekannte Größe: nur "Wird geladen…", kein geratener Balken', () => {
    zeile({ laedt: true, prozent: null });
    expect(screen.getByText('Wird geladen…')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('Grenzfall 0 %: der Balken steht schon da (0 ist eine Zahl, kein "unbekannt")', () => {
    zeile({ laedt: true, prozent: 0 });
    expect(screen.getByText('Wird geladen… 0 %')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('der Balken nimmt die übergebene Farbe an', () => {
    zeile({ laedt: true, prozent: 40, farbe: 'rgb(10, 20, 30)' });
    expect(screen.getByRole('progressbar').parentElement!.style.color).toBe('rgb(10, 20, 30)');
  });
});
