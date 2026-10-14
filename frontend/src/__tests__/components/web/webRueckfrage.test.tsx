// Rückfragen in den Fenstern der Web-Fassung (13.10.2026). Simon im
// Seiten-Interview: „die loeschenmodal duerften ein symbol haben und einen
// roten button." Die Rückfragen aus useIonAlert haben das seitdem
// (utils/rueckfragenOptik.ts, theme/rueckfragen.css). Einige Rückfragen der
// Web-Fassung sind aber eigene Fenster (WebDialog) oder eine Zeile in einem
// Fenster -- dort hätte ein ion-alert bis 12.10.2026 unter dem Fenster
// gelegen. Sie sahen anders aus: kein Symbol, „Verwerfen" weiß mit rotem
// Text. Mit `rueckfrage` zeigt der WebDialog dasselbe Symbol über dem Titel
// und füllt den Gefahr-Knopf rot.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';

// Das Symbol als prüfbares Element: welches Icon steht darin?
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
}));

import WebDialog from '../../../components/web/WebDialog';
import WebKnopf from '../../../components/web/WebKnopf';
import WebRueckfrageSymbol from '../../../components/web/WebRueckfrageSymbol';
import { rueckfrageKennzeichnen, RUECKFRAGE_SYMBOL, type RueckfrageArt } from '../../../utils/rueckfragenOptik';
import { ICON_LOESCHEN_GEFUELLT, ICON_WARNUNG_GEFUELLT } from '../../../components/shared/icons';
import { erwarteWebRueckfrage } from './webRueckfrageErwartung';

afterEach(cleanup);

const knoepfe = (gefahr: string) => (
  <>
    <WebKnopf onClick={() => {}}>Abbrechen</WebKnopf>
    <WebKnopf art="gefahr" onClick={() => {}}>{gefahr}</WebKnopf>
  </>
);

describe('WebDialog mit rueckfrage', () => {
  it('Löschen: der Mülleimer steht im Kopf über dem Titel, das Fenster ist als Rückfrage gekennzeichnet', () => {
    render(
      <WebDialog titel="Datei löschen" beschreibung="„lieder.pdf“ wirklich löschen?" rueckfrage="loeschen" onSchliessen={() => {}} aktionen={knoepfe('Löschen')}>
        {null}
      </WebDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Datei löschen' });
    erwarteWebRueckfrage(dialog, 'loeschen', 'Löschen');
    const kopf = dialog.querySelector('.web-dialog__kopf') as HTMLElement;
    const symbol = kopf.querySelector('.web-rueckfrage-symbol') as HTMLElement;
    expect(symbol.querySelector('i')).toHaveAttribute('data-icon', ICON_LOESCHEN_GEFUELLT);
    // Vor dem Titel, und das X bleibt.
    expect([...kopf.children].map((k) => k.className)).toEqual([
      'web-rueckfrage-symbol web-rueckfrage-symbol--loeschen',
      'web-dialog__titel',
      'web-knopf web-knopf--text web-knopf--symbol',
    ]);
    // Name und Beschreibung bleiben, wie sie waren: das Symbol liest niemand vor.
    expect(dialog).toHaveAccessibleDescription('„lieder.pdf“ wirklich löschen?');
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
  });

  it('Warnung: das Warndreieck', () => {
    render(
      <WebDialog titel="Ungespeicherte Änderungen" rueckfrage="warnung" onSchliessen={() => {}} aktionen={knoepfe('Verwerfen')}>
        {null}
      </WebDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    erwarteWebRueckfrage(dialog, 'warnung', 'Verwerfen');
    expect(dialog.querySelector('.web-rueckfrage-symbol i')).toHaveAttribute('data-icon', ICON_WARNUNG_GEFUELLT);
  });

  it('ohne rueckfrage bleibt ein Fenster, wie es war: kein Symbol, keine Kennzeichnung -- auch mit einem Gefahr-Knopf darin', () => {
    render(
      <WebDialog titel="Mara Probe" beschreibung="Teilnahme verwalten" onSchliessen={() => {}}>
        <WebKnopf art="gefahr" onClick={() => {}}>Teilnahme entfernen</WebKnopf>
      </WebDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mara Probe' });
    expect(dialog.className).toBe('web-dialog');
    expect(dialog.closest('.web-rueckfrage')).toBeNull();
    expect(dialog.querySelector('.web-rueckfrage-symbol')).toBeNull();
    expect([...(dialog.querySelector('.web-dialog__kopf') as HTMLElement).children].map((k) => k.tagName)).toEqual(['H2', 'BUTTON']);
  });

  it('breit und Rückfrage zugleich: beide Klassen', () => {
    render(<WebDialog titel="Beitrag ausblenden" rueckfrage="warnung" breit onSchliessen={() => {}}>{null}</WebDialog>);
    expect(screen.getByRole('dialog', { name: 'Beitrag ausblenden' }).className).toBe('web-dialog web-dialog--breit web-rueckfrage');
  });
});

describe('WebRueckfrageSymbol', () => {
  it.each<[RueckfrageArt, string, string]>([
    ['loeschen', 'Löschen', ICON_LOESCHEN_GEFUELLT],
    ['warnung', 'Verwerfen', ICON_WARNUNG_GEFUELLT],
  ])('%s: dasselbe Symbol, das die Rückfragen der App bekommen', (art, knopf, icon) => {
    const { container } = render(<WebRueckfrageSymbol art={art} />);
    const symbol = container.firstElementChild as HTMLElement;
    expect(symbol.className).toBe(`web-rueckfrage-symbol web-rueckfrage-symbol--${art}`);
    expect(symbol).toHaveAttribute('aria-hidden', 'true');
    expect(symbol.querySelector('i')).toHaveAttribute('data-icon', icon);
    // Eine Rückfrage der App mit demselben Knopf bekommt dasselbe Symbol.
    const alert = Object.assign(document.createElement('ion-alert'), { buttons: [{ text: 'Abbrechen', role: 'cancel' }, { text: knopf, role: 'destructive' }] });
    expect(rueckfrageKennzeichnen(alert)).toBe(art);
    expect(alert.style.getPropertyValue(RUECKFRAGE_SYMBOL)).toBe(`url("${icon}")`);
  });

  it('klein: für die Rückfrage in einer Zeile', () => {
    const { container } = render(<WebRueckfrageSymbol art="loeschen" klein />);
    expect((container.firstElementChild as HTMLElement).className).toBe('web-rueckfrage-symbol web-rueckfrage-symbol--loeschen web-rueckfrage-symbol--klein');
  });
});
