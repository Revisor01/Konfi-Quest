import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import PollModal from '../../components/chat/modals/PollModal';

// PollModal braucht nur den Online-Status und die Fehleranzeige aus dem Context.
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    isOnline: true,
    setError: vi.fn()
  })
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({
    isSubmitting: false,
    guard: async (fn: () => Promise<void>) => fn()
  })
}));

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() }
}));

const HINTS = [
  'Mehrere Antworten erlauben',
  'Sichtbar machen, wer welche Antwort gewählt hat',
  'Jede Option kann nur von einer Person gewählt werden',
  'Umfrage automatisch schließen'
];

describe('PollModal Einstellungen', () => {
  it('alle vier Erklärungstexte tragen die globale Mehrzeilen-Klasse', () => {
    const { container } = render(
      <PollModal onClose={() => {}} onSuccess={() => {}} roomId={1} />
    );

    const hints = Array.from(container.querySelectorAll('p.app-toggle-item__hint'));
    expect(hints.length).toBe(4);
    const texte = hints.map((el) => el.textContent?.trim());
    for (const hint of HINTS) {
      expect(texte).toContain(hint);
    }
  });

  it('Schalter folgen dem Challenge-Muster: Label links, Toggle im end-Slot', () => {
    const { container } = render(
      <PollModal onClose={() => {}} onSuccess={() => {}} roomId={1} />
    );

    const titel = Array.from(container.querySelectorAll('h3.app-toggle-item__title'));
    expect(titel.map((el) => el.textContent)).toEqual([
      'Mehrfachauswahl', 'Namen anzeigen', 'Exklusive Optionen', 'Ablaufdatum'
    ]);

    // Jeder Titel sitzt in einem ion-item, dessen Toggle rechts (slot=end) steht —
    // nicht mehr als Wrapper um das Label (dort schnitt Ionic den Text ab).
    for (const h3 of titel) {
      const item = h3.closest('ion-item');
      expect(item).toBeTruthy();
      const toggle = item!.querySelector('ion-toggle');
      expect(toggle).toBeTruthy();
      expect(toggle!.getAttribute('slot')).toBe('end');
      expect(toggle!.querySelector('ion-label')).toBeNull();
    }
  });

  it('globales CSS definiert die Mehrzeilen-Klassen mit white-space normal', () => {
    // Die Klassen leben in theme/variables.css — verschwinden sie dort,
    // bricht der Umbruch der Erklärungstexte wieder ab.
    const css = fs.readFileSync(
      path.resolve(__dirname, '../../theme/variables.css'),
      'utf8'
    );

    const hintBlock = css.match(/\.app-toggle-item__hint\s*\{[^}]*\}/);
    expect(hintBlock).not.toBeNull();
    expect(hintBlock![0]).toContain('white-space: normal');

    const titleBlock = css.match(/\.app-toggle-item__title\s*\{[^}]*\}/);
    expect(titleBlock).not.toBeNull();
    expect(titleBlock![0]).toContain('white-space: normal');
  });
});
