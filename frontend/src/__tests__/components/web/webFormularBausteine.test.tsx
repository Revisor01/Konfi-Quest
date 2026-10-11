// Bausteine fuer die Web-Fassungen der haeufigen Formulare (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"): Datum und
// Uhrzeit, Mehrfachauswahl, breiter Dialog, Grenzen und Platzhalter der
// Felder. Gerendert wie eine Person sie bedient.
import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));

import WebDatum from '../../../components/web/WebDatum';
import { fuerFeld, ausFeld } from '../../../components/web/webDatumWert';
import WebMehrfachAuswahl from '../../../components/web/WebMehrfachAuswahl';
import WebDialog from '../../../components/web/WebDialog';
import WebFeld from '../../../components/web/WebFeld';
import WebTextfeld from '../../../components/web/WebTextfeld';

describe('WebDatum: Datum, Datum mit Uhrzeit, Uhrzeit', () => {
  it('Datum: ein echtes Datumsfeld, benannt nach der Beschriftung; liefert "JJJJ-MM-TT"', () => {
    const onWert = vi.fn();
    render(<WebDatum label="Datum" art="datum" wert="2026-10-11" onWert={onWert} pflicht />);
    const feld = screen.getByLabelText('Datum') as HTMLInputElement;
    expect(feld).toHaveAttribute('type', 'date');
    expect(feld.value).toBe('2026-10-11');
    expect(feld).toHaveAttribute('aria-required', 'true');
    fireEvent.change(feld, { target: { value: '2026-12-24' } });
    expect(onWert).toHaveBeenCalledWith('2026-12-24');
  });

  it('Datum und Uhrzeit: liest den lokalen Wert der App-Formulare und gibt ihn in derselben Form zurück ("…T18:30:00")', () => {
    const onWert = vi.fn();
    render(<WebDatum label="Beginn" art="datumUhrzeit" wert="2026-10-11T18:00:00" onWert={onWert} min="2026-10-01T00:00:00" schritt={900} />);
    const feld = screen.getByLabelText('Beginn') as HTMLInputElement;
    expect(feld).toHaveAttribute('type', 'datetime-local');
    expect(feld.value).toBe('2026-10-11T18:00');
    expect(feld).toHaveAttribute('min', '2026-10-01T00:00');
    expect(feld).toHaveAttribute('step', '900');
    fireEvent.change(feld, { target: { value: '2026-10-11T18:30' } });
    expect(onWert).toHaveBeenCalledWith('2026-10-11T18:30:00');
  });

  it('Uhrzeit: nimmt "HH:MM" oder die Uhrzeit aus einem ISO-Wert', () => {
    const onWert = vi.fn();
    render(<WebDatum label="Startzeit" art="uhrzeit" wert="2026-10-11T09:15:00" onWert={onWert} hinweis="Zeitfenster 1" />);
    const feld = screen.getByLabelText('Startzeit') as HTMLInputElement;
    expect(feld).toHaveAttribute('type', 'time');
    expect(feld.value).toBe('09:15');
    expect(feld).toHaveAccessibleDescription('Zeitfenster 1');
    fireEvent.change(feld, { target: { value: '10:45' } });
    expect(onWert).toHaveBeenCalledWith('10:45');
  });

  it('Umwandlung: leer bleibt leer, Unlesbares wird leer statt falsch', () => {
    expect(fuerFeld('', 'datum')).toBe('');
    expect(fuerFeld(null, 'datumUhrzeit')).toBe('');
    expect(fuerFeld('2026-10-11T18:30:00', 'datum')).toBe('2026-10-11');
    expect(fuerFeld('2026-10-11', 'datumUhrzeit')).toBe('');
    expect(fuerFeld('morgen', 'uhrzeit')).toBe('');
    expect(ausFeld('', 'datumUhrzeit')).toBe('');
    expect(ausFeld('2026-10-11T18:30', 'datumUhrzeit')).toBe('2026-10-11T18:30:00');
    expect(ausFeld('2026-10-11', 'datum')).toBe('2026-10-11');
  });
});

describe('WebMehrfachAuswahl', () => {
  const JAHRGAENGE = [
    { wert: '1', titel: '2025/2026' },
    { wert: '2', titel: '2026/2027', beschreibung: 'Konfirmation im Mai' },
    { wert: '3', titel: '2027/2028' },
  ];

  const Harness: React.FC<{ start?: string[] }> = ({ start = [] }) => {
    const [werte, setWerte] = useState<string[]>(start);
    return (
      <>
        <WebMehrfachAuswahl label="Jahrgänge" eintraege={JAHRGAENGE} werte={werte} onWerte={setWerte} pflicht leerText="Keine Jahrgänge" hinweis="Leer heißt: ganze Gemeinde" />
        <output data-testid="werte">{werte.join(',')}</output>
      </>
    );
  };

  it('eine benannte Gruppe mit einem Ankreuzfeld je Eintrag; Pflicht und Hinweis hängen an der Gruppe', () => {
    render(<Harness start={['2']} />);
    const gruppe = screen.getByRole('group', { name: 'Jahrgänge' });
    expect(gruppe).toHaveAttribute('aria-required', 'true');
    expect(gruppe).toHaveAccessibleDescription('Leer heißt: ganze Gemeinde');
    const haken = within(gruppe).getAllByRole('checkbox');
    expect(haken.map((h) => (h as HTMLInputElement).checked)).toEqual([false, true, false]);
    expect(within(gruppe).getByText('Konfirmation im Mai')).toBeTruthy();
  });

  it('An- und Abwählen meldet die Werte in der Reihenfolge der Liste, nicht der Klicks', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: '2027/2028' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '2025/2026' }));
    expect(screen.getByTestId('werte').textContent).toBe('1,3');
    fireEvent.click(screen.getByRole('checkbox', { name: '2027/2028' }));
    expect(screen.getByTestId('werte').textContent).toBe('1');
  });

  it('ohne Einträge steht der Leertext statt einer leeren Liste', () => {
    render(<WebMehrfachAuswahl label="Kategorien" eintraege={[]} werte={[]} onWerte={() => {}} leerText="Noch keine Kategorien angelegt." />);
    expect(screen.getByRole('status').textContent).toBe('Noch keine Kategorien angelegt.');
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });
});

describe('WebDialog breit und WebFeld mit Grenzen', () => {
  it('breit: Klasse für 720 px; ohne: die schmale Form', () => {
    const { unmount } = render(<WebDialog titel="Neues Event" onSchliessen={() => {}} breit><p>Inhalt</p></WebDialog>);
    expect(screen.getByRole('dialog', { name: 'Neues Event' }).className).toBe('web-dialog web-dialog--breit');
    unmount();
    render(<WebDialog titel="Neue Kategorie" onSchliessen={() => {}}><p>Inhalt</p></WebDialog>);
    expect(screen.getByRole('dialog', { name: 'Neue Kategorie' }).className).toBe('web-dialog');
  });

  it('WebFeld: Zahl mit Grenzen und Schritt, Platzhalter als Beispiel -- der Name bleibt die Beschriftung', () => {
    render(<WebFeld label="Punkte" typ="number" wert="2" onWert={() => {}} min={1} max={10} schritt={1} platzhalter="z. B. 2" />);
    const feld = screen.getByRole('spinbutton', { name: 'Punkte' });
    expect(feld).toHaveAttribute('min', '1');
    expect(feld).toHaveAttribute('max', '10');
    expect(feld).toHaveAttribute('step', '1');
    expect(feld).toHaveAttribute('placeholder', 'z. B. 2');
  });

  it('WebTextfeld: Platzhalter', () => {
    render(<WebTextfeld label="Beschreibung" wert="" onWert={() => {}} platzhalter="Worum geht es?" />);
    expect(screen.getByRole('textbox', { name: 'Beschreibung' })).toHaveAttribute('placeholder', 'Worum geht es?');
  });
});
