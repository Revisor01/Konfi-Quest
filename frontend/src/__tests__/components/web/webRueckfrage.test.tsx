// Rückfragen in den Fenstern der Web-Fassung (13.10.2026). Mit `rueckfrage`
// zeigt der WebDialog ein Symbol über dem Titel. Wie es aussieht, bleibt
// frei (Simon, 15.10.2026); geprüft wird, was Vorleseprogramme davon haben:
// Name und Beschreibung des Fensters bleiben, das Symbol liest niemand vor.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';

// IonIcon als schlichtes Element.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
}));

import WebDialog from '../../../components/web/WebDialog';
import WebKnopf from '../../../components/web/WebKnopf';
import WebRueckfrageSymbol from '../../../components/web/WebRueckfrageSymbol';
import type { RueckfrageArt } from '../../../utils/rueckfragenOptik';

afterEach(cleanup);

const knoepfe = (gefahr: string) => (
  <>
    <WebKnopf onClick={() => {}}>Abbrechen</WebKnopf>
    <WebKnopf art="gefahr" onClick={() => {}}>{gefahr}</WebKnopf>
  </>
);

describe('WebDialog mit rueckfrage', () => {
  it('Löschen: Name und Beschreibung bleiben, wie sie waren, und das X bleibt', () => {
    render(
      <WebDialog titel="Datei löschen" beschreibung="„lieder.pdf“ wirklich löschen?" rueckfrage="loeschen" onSchliessen={() => {}} aktionen={knoepfe('Löschen')}>
        {null}
      </WebDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Datei löschen' });
    expect(dialog).toHaveAccessibleDescription('„lieder.pdf“ wirklich löschen?');
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
  });
});

describe('WebRueckfrageSymbol', () => {
  it.each<RueckfrageArt>(['loeschen', 'warnung'])('%s: das Symbol ist für Vorleseprogramme ausgeblendet', (art) => {
    const { container } = render(<WebRueckfrageSymbol art={art} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
