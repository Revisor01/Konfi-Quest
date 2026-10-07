// Angaben stehen in der Web-Fassung immer mit Symbol (Simon, 07.10.2026: „also
// angaben immer mit icons"): aus der Tabelle angabeSymbole.ts, von der Seite
// mitgegeben, oder -- wenn eine Bezeichnung fehlt -- ein markiertes Ersatzsymbol.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@ionic/react', () => ({
  IonIcon: ({ icon, className, ...rest }: { icon?: string; className?: string; 'data-symbol'?: string }) => (
    <i data-testid="symbol" data-icon={icon} className={className} data-symbol={rest['data-symbol']} />
  ),
}));

import WebAngaben from '../../components/web/WebAngaben';
import { ANGABE_SYMBOLE } from '../../components/web/angabeSymbole';
import { terminAngaben } from '../../utils/termineWeb';
import type { Event } from '../../types/event';

const symbolVon = (label: string) => screen.getByText(label).querySelector('[data-testid="symbol"]') as HTMLElement;

describe('WebAngaben: jede Angabe mit Symbol', () => {
  it('holt Symbol und Farbe aus der Tabelle', () => {
    render(<WebAngaben angaben={[{ label: 'Datum', wert: '14.10.2026' }, { label: 'Ort', wert: 'Kirche' }]} />);
    expect(symbolVon('Datum').getAttribute('data-icon')).toBe(ANGABE_SYMBOLE.Datum.icon);
    expect(symbolVon('Datum')).toHaveClass('web-angaben__icon', 'app-icon-color--events');
    expect(symbolVon('Ort')).toHaveClass('app-icon-color--location');
    expect(symbolVon('Ort')).not.toHaveAttribute('data-symbol');
  });

  it('ein mitgegebenes Symbol geht vor (Konfispruch heisst nach der Bibelstelle)', () => {
    render(<WebAngaben angaben={[{ label: 'Psalm 23,1', wert: 'Der Herr ist mein Hirte.', icon: 'buch', iconKlasse: 'app-icon-color--konfis' }]} />);
    expect(symbolVon('Psalm 23,1').getAttribute('data-icon')).toBe('buch');
    expect(symbolVon('Psalm 23,1')).toHaveClass('app-icon-color--konfis');
  });

  it('eine unbekannte Bezeichnung bekommt das Ersatzsymbol und ist markiert -- nie gar keins', () => {
    render(<WebAngaben angaben={[{ label: 'Gibt es nicht', wert: 'x' }]} />);
    expect(symbolVon('Gibt es nicht')).toHaveAttribute('data-symbol', 'ersatz');
  });
});

describe('Event-Angaben: jede Bezeichnung steht in der Tabelle', () => {
  const voll = {
    id: 1, name: 'Konfi-Tag', event_date: '2026-11-14T09:00:00Z', event_end_time: '2026-11-14T15:00:00Z',
    points: 2, point_type: 'gemeinde', max_participants: 20, registered_count: 3, registration_status: 'open', type: 'event',
    mandatory: true, location: 'Gemeindehaus', categories: [{ id: 1, name: 'Freizeit' }], bring_items: 'Schlafsack',
    checkin_window: 30, teamer_needed: true, teamer_max_participants: 4, teamer_count: 1, waitlist_enabled: true,
    waitlist_count: 1, max_waitlist_size: 10, is_series: true, jahrgaenge: [{ name: '2025/2026' }],
  } as unknown as Event & { jahrgaenge: Array<{ name: string }> };

  it.each(['leitung', 'team', 'konfi'] as const)('Rolle %s: keine Angabe ohne eigenes Symbol (Typ haengt am Wert)', (rolle) => {
    const labels = terminAngaben(voll, { rolle, materialien: [{ id: 1, title: 'Packliste' }] }).map((a) => a.label);
    expect(labels.length).toBeGreaterThan(5);
    expect(labels.filter((l) => l !== 'Typ' && !ANGABE_SYMBOLE[l])).toEqual([]);
  });
});
