import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InfoModal from '../../../components/shared/InfoModal';

// Das Erklär-Modal hinter dem (i) auf der "Mehr"-Seite der Leitung
// (Audit Tests 26.09.2026, BF-10: ohne Test). Gerendert mit dem echten Ionic.

const ABSAETZE = [
  'Jahrgänge fassen die Konfis eines Durchgangs zusammen.',
  'Teamer:innen sehen nur ihre zugewiesenen Jahrgänge.',
];

const oeffne = (props: Partial<React.ComponentProps<typeof InfoModal>> = {}) => {
  const onClose = vi.fn();
  const r = render(
    <InfoModal onClose={onClose} title="Jahrgänge" icon="school" paragraphs={ABSAETZE} {...props} />
  );
  return { onClose, ...r };
};

describe('InfoModal', () => {
  it('nennt den Titel in der Kopfzeile und als Überschrift', () => {
    const { container } = oeffne();
    expect(container.querySelector('ion-title')!.textContent).toBe('Jahrgänge');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Jahrgänge');
  });

  it('jeder Eintrag wird ein eigener Absatz, in derselben Reihenfolge', () => {
    const { container } = oeffne();
    const absaetze = [...container.querySelectorAll('p')].map((p) => p.textContent);
    expect(absaetze).toEqual(ABSAETZE);
  });

  it('Grenzfall ohne Absätze: kein leerer Absatz, der Titel bleibt', () => {
    const { container } = oeffne({ paragraphs: [] });
    expect(container.querySelectorAll('p')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Jahrgänge');
  });

  it('der Schließen-Knopf ist benannt und schließt genau einmal', () => {
    const { container, onClose } = oeffne();
    const schliessen = container.querySelector('[aria-label="Schließen"]') as HTMLElement;
    expect(schliessen.tagName).toBe('ION-BUTTON');
    fireEvent.click(schliessen);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('der Symbol-Kreis trägt die Bereichsfarbe, ohne Angabe die Info-Farbe', () => {
    const ohne = oeffne();
    const kreisOhne = screen.getByRole('heading', { level: 1 }).previousElementSibling as HTMLElement;
    expect(kreisOhne.getAttribute('style')).toContain('background: var(--app-color-info)');
    ohne.unmount();

    oeffne({ color: 'var(--app-color-jahrgang)' });
    const kreis = screen.getByRole('heading', { level: 1 }).previousElementSibling as HTMLElement;
    expect(kreis.getAttribute('style')).toContain('background: var(--app-color-jahrgang)');
  });
});
