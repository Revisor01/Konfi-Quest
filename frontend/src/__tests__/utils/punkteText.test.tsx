import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Simon, 01.10.2026: Auf der Konfi-Startseite stand „Nächstes Level:
// Legende — noch 1 Punkte". Bei genau einem Punkt heißt es „1 Punkt".
// Die Einzahl stand bisher an jeder Stelle selbst (Antrag, Konfi-Zeit,
// Rückblick) -- oder eben nicht. Jetzt an einer: utils/punkteText.

vi.mock('@ionic/react', () => ({
  IonIcon: () => null,
  IonProgressBar: () => null,
}));

import { punktWort, punkteText } from '../../utils/punkteText';
import { LevelProgress } from '../../components/konfi/views/DashboardSections';

describe('punktWort / punkteText -- Einzahl nur bei genau 1', () => {
  it('1 -> „Punkt"', () => {
    expect(punktWort(1)).toBe('Punkt');
    expect(punkteText(1)).toBe('1 Punkt');
  });

  it('2 -> „Punkte"', () => {
    expect(punktWort(2)).toBe('Punkte');
    expect(punkteText(2)).toBe('2 Punkte');
  });

  it('0 -> „Punkte" (im Deutschen „0 Punkte", nicht „0 Punkt")', () => {
    expect(punktWort(0)).toBe('Punkte');
    expect(punkteText(0)).toBe('0 Punkte');
  });

  it('-1 -> „Punkte" (abgezogene Punkte bleiben Mehrzahl, wie bisher)', () => {
    expect(punkteText(-1)).toBe('-1 Punkte');
  });
});

describe('Konfi-Startseite: Fortschritt zum nächsten Level', () => {
  const naechstes = { title: 'Legende', points_required: 50 };

  it('zeigt bei einem fehlenden Punkt „noch 1 Punkt"', () => {
    render(<LevelProgress nextLevel={naechstes} progressPercentage={98} pointsToNextLevel={1} />);
    expect(screen.getByText('noch 1 Punkt')).toBeInTheDocument();
    expect(screen.queryByText('noch 1 Punkte')).toBeNull();
  });

  it('zeigt bei zwei fehlenden Punkten „noch 2 Punkte"', () => {
    render(<LevelProgress nextLevel={naechstes} progressPercentage={96} pointsToNextLevel={2} />);
    expect(screen.getByText('noch 2 Punkte')).toBeInTheDocument();
  });

  it('zeigt ohne fehlende Punkte weiter die Prozentzahl', () => {
    render(<LevelProgress nextLevel={naechstes} progressPercentage={100} pointsToNextLevel={0} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
