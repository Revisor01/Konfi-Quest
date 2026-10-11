// Auswahl mit Suche in einem Formular (Gegenprüfung 11.10.2026, Befund zu
// „Aktivität eintragen“ im Browser): Enter im Suchfeld schickte das Formular
// des Dialogs ab -- nach HTML-Regel (implizites Absenden über den Knopf mit
// type="submit") -- und buchte die zuvor gewählte Aktivität, obwohl die Suche
// sie schon ausgeblendet hatte und nichts mehr zeigte, was gewählt war.
//
// jsdom kennt das implizite Absenden nicht. Geprüft wird deshalb, dass Enter
// im Suchfeld abgefangen wird (das Ereignis kommt als "verhindert" zurück) --
// genau das hält den Browser vom Absenden ab; im echten Chromium nachgesehen.
// Dazu: Bei genau einem Treffer wählt Enter diesen, und eine ausgeblendete
// Wahl bleibt als „Gewählt: …“ sichtbar.
import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));

import WebAuswahlSuche from '../../../components/web/WebAuswahlSuche';

const EINTRAEGE = [
  { wert: '1', titel: 'Kirchengemeinde Büsum', beschreibung: 'Anna Beispiel · Neu' },
  { wert: '2', titel: 'Kirchengemeinde Wiesengrund', beschreibung: 'Jan Vorlage · In Arbeit' },
  { wert: '3', titel: 'Jugendwerk Beispielstadt', beschreibung: 'Ole Entwurf · Abgelehnt' },
];

/** Die Auswahl in einem Formular, wie im Dialog: Wählen ändert den Wert, Absenden wird gezählt. */
const Formular: React.FC<{ start: string; onWert: (w: string) => void; onAbsenden: () => void }> = ({ start, onWert, onAbsenden }) => {
  const [wert, setWert] = useState(start);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAbsenden(); }}>
      <WebAuswahlSuche
        label="Anfrage"
        suchePlatzhalter="Anfrage suchen"
        leerText="Es gibt keine Anfragen."
        eintraege={EINTRAEGE}
        wert={wert}
        onWert={(w) => { setWert(w); onWert(w); }}
      />
      <button type="submit">Einsortieren</button>
    </form>
  );
};

const zeigen = (start = '') => {
  const onWert = vi.fn();
  const onAbsenden = vi.fn();
  render(<Formular start={start} onWert={onWert} onAbsenden={onAbsenden} />);
  return { onWert, onAbsenden, suche: screen.getByRole('searchbox', { name: 'Anfrage suchen' }) };
};
const suchen = (feld: HTMLElement, text: string) => fireEvent.change(feld, { target: { value: text } });
/** Gibt false zurück, wenn die Auswahl das Enter abgefangen hat (kein Absenden im Browser). */
const enter = (feld: HTMLElement) => fireEvent.keyDown(feld, { key: 'Enter', code: 'Enter' });

describe('WebAuswahlSuche im Formular: Enter im Suchfeld schickt nicht ab', () => {
  it('Enter bei genau einem Treffer: abgefangen und dieser Eintrag gewählt', () => {
    const { onWert, onAbsenden, suche } = zeigen('1');
    suchen(suche, 'wiesengrund');
    expect(enter(suche)).toBe(false);
    expect(onWert).toHaveBeenCalledTimes(1);
    expect(onWert).toHaveBeenCalledWith('2');
    expect(screen.getByRole('radio', { name: /Wiesengrund/ })).toBeChecked();
    expect(onAbsenden).not.toHaveBeenCalled();
  });

  it('Enter bei mehreren Treffern, ohne Treffer und ohne Suche: abgefangen, die Wahl bleibt', () => {
    const { onWert, suche } = zeigen('3');
    suchen(suche, 'kirchengemeinde');
    expect(enter(suche)).toBe(false);
    suchen(suche, 'xyz');
    expect(enter(suche)).toBe(false);
    suchen(suche, '');
    expect(enter(suche)).toBe(false);
    expect(onWert).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Beispielstadt/ })).toBeChecked();
  });

  it('andere Tasten im Suchfeld lässt die Auswahl durch', () => {
    const { suche } = zeigen();
    expect(fireEvent.keyDown(suche, { key: 'a', code: 'KeyA' })).toBe(true);
    expect(fireEvent.keyDown(suche, { key: 'Escape', code: 'Escape' })).toBe(true);
  });

  it('blendet die Suche die Wahl aus, steht sie als „Gewählt: …“ da; sonst nicht', () => {
    const { suche } = zeigen('1');
    expect(screen.queryByText(/^Gewählt:/)).toBeNull();
    suchen(suche, 'jugend');
    expect(screen.getByText(/^Gewählt:/)).toHaveTextContent('Gewählt: Kirchengemeinde Büsum');
    suchen(suche, 'xyz');
    expect(screen.getByText(/^Gewählt:/)).toHaveTextContent('Gewählt: Kirchengemeinde Büsum');
    // In der Liste sichtbar: angekreuzt, keine zweite Zeile dazu.
    suchen(suche, 'buesum');
    expect(screen.getByRole('radio', { name: /Büsum/ })).toBeChecked();
    expect(screen.queryByText(/^Gewählt:/)).toBeNull();
  });

  it('ohne Wahl gibt es keine „Gewählt“-Zeile, auch nicht beim Suchen', () => {
    const { suche } = zeigen('');
    suchen(suche, 'jugend');
    expect(screen.queryByText(/^Gewählt:/)).toBeNull();
  });
});
