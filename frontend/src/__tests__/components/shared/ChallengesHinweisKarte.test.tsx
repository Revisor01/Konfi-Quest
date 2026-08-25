import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChallengesHinweisKarte from '../../../components/shared/ChallengesHinweisKarte';

const UNTERTITEL = 'Aufgaben stellen und Beiträge der Konfis begleiten';
const KARTE = `Challenges: ${UNTERTITEL}`;

describe('ChallengesHinweisKarte', () => {
  it('nutzt denselben Banner-Look wie die anderen Hinweise', () => {
    // Der Kern des Nutzerhinweises vom 25.08.2026: Die Karte sah im
    // Teamer-Dashboard anders aus als "Was ist neu?" und der Mitmachen-
    // Hinweis direkt daneben, weil sie dort aus app-list-item gebaut war.
    render(<ChallengesHinweisKarte onOpen={vi.fn()} untertitel={UNTERTITEL} />);
    const karte = screen.getByRole('button', { name: KARTE });
    expect(karte).toHaveClass('app-whatsnew');
    expect(karte).toHaveClass('app-whatsnew--challenges');
    expect(karte).not.toHaveClass('app-list-item');
  });

  it('zeigt Titel und den uebergebenen Untertitel', () => {
    render(<ChallengesHinweisKarte onOpen={vi.fn()} untertitel={UNTERTITEL} />);
    expect(screen.getByText('Challenges')).toBeInTheDocument();
    expect(screen.getByText(UNTERTITEL)).toBeInTheDocument();
  });

  it('Tippen oeffnet den Challenges-Bereich', () => {
    const onOpen = vi.fn();
    render(<ChallengesHinweisKarte onOpen={onOpen} untertitel={UNTERTITEL} />);
    fireEvent.click(screen.getByRole('button', { name: KARTE }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('Enter auf der fokussierten Karte oeffnet ebenfalls', () => {
    const onOpen = vi.fn();
    render(<ChallengesHinweisKarte onOpen={onOpen} untertitel={UNTERTITEL} />);
    fireEvent.keyDown(screen.getByRole('button', { name: KARTE }), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('ohne onDismiss gibt es kein X, sondern einen Pfeil', () => {
    render(<ChallengesHinweisKarte onOpen={vi.fn()} untertitel={UNTERTITEL} />);
    expect(screen.queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull();
  });

  it('mit onDismiss blendet das X aus, ohne zu oeffnen', () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ChallengesHinweisKarte onOpen={onOpen} onDismiss={onDismiss} untertitel={UNTERTITEL} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(0);
  });
});
