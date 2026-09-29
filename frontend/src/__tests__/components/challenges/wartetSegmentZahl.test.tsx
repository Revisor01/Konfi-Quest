import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Orange Zahl am Reiter "Wartet" in der geoeffneten Challenge (Simon,
// 29.09.2026): Orange steht nur fuer Wartendes -- am Eck-Badge der Liste, am
// Umschalter Aktuell/Geplant/Archiv und hier. Sie sieht aus wie die Zahl am
// Umschalter (dasselbe Bauteil SegmentZahl, keine Abschrift), zaehlt die
// wartenden Beitraege dieser Challenge und geht beim Freigeben und Ablehnen
// sofort mit.

const apiGet = vi.fn();
const apiPut = vi.fn(async (..._args: unknown[]) => ({ data: {} }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));

vi.mock('../../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
  triggerPullHaptic: vi.fn(),
}));

const stabil = { user: { id: 5, type: 'admin' }, setError: vi.fn(), setSuccess: vi.fn() };
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => stabil }));

// Die Rueckfrage beim Ablehnen wird sofort bestaetigt (ohne Begruendung).
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonAlert: () => [(optionen: { buttons: Array<{ role?: string; handler?: (d?: unknown) => void }> }) => {
    optionen.buttons.find((b) => b.role === 'destructive')?.handler?.({ reason: '' });
  }],
  useIonActionSheet: () => [vi.fn()],
}));

import ChallengeLeitungModal from '../../../components/admin/modals/ChallengeLeitungModal';

const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const challenge = {
  id: 7, title: 'Mit Freigabe', description: 'Schreib uns', visibility: 'public',
  moderated: true, is_draft: false, allow_multiple: true, starts_at: vorZweiWochen, ends_at: inEinerWoche,
};
const beitrag = (id: number, status: 'pending' | 'approved' | 'hidden') => ({
  id, media_type: 'text', text_content: `Beitrag ${id}`, moderation_status: status,
  created_at: vorZweiWochen, display_name: `Konfi ${id}`, user_id: 100 + id,
});

let beitraege: unknown[] = [];

beforeEach(() => {
  localStorage.clear();
  apiGet.mockReset();
  apiPut.mockClear();
  beitraege = [beitrag(1, 'pending'), beitrag(2, 'pending'), beitrag(3, 'approved')];
  apiGet.mockImplementation(async (route: string) => {
    if (route === '/challenges/admin/7/submissions') return { data: { challenge, submissions: beitraege } };
    throw new Error(`unerwartet: ${route}`);
  });
});

afterEach(() => cleanup());

// Ionic setzt value als Eigenschaft, nicht als Attribut -- die Knoepfe
// deshalb ueber ihre Beschriftung finden (wie segmentZahlenLeitung.test.tsx).
const BESCHRIFTUNG: Record<string, string> = { feed: 'Feed', pending: 'Wartet', hidden: 'Abgelehnt', meins: 'Meins' };
const knopf = (container: HTMLElement, wert: string) =>
  [...container.querySelectorAll('ion-segment-button')]
    .find((k) => k.textContent?.startsWith(BESCHRIFTUNG[wert])) as HTMLElement;

const oeffnen = async () => {
  const ansicht = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
  await waitFor(() => expect(knopf(ansicht.container, 'pending').querySelector('.app-segment-zahl')).not.toBeNull());
  return ansicht;
};

describe('Reiter „Wartet": orange Zahl der wartenden Beitraege', () => {
  it('zeigt die Zahl der wartenden Beitraege dieser Challenge, orange wie am Umschalter', async () => {
    const { container } = await oeffnen();
    const zahl = knopf(container, 'pending').querySelector('.app-segment-zahl') as HTMLElement;
    expect(zahl.textContent).toBe('2');
    expect(zahl.getAttribute('role')).toBe('img');
    expect(zahl.getAttribute('aria-label')).toBe('2 warten auf Freigabe');
    // Nur am Reiter "Wartet" -- Feed, Abgelehnt und Meins tragen keine Zahl.
    for (const anderer of ['feed', 'hidden', 'meins']) {
      expect(knopf(container, anderer).querySelector('.app-segment-zahl')).toBeNull();
    }
    // Kein roter Kreis an einem Reiter.
    expect(container.querySelector('ion-segment .app-zaehler-kugel')).toBeNull();
  });

  it('bei 0 wartenden keine Zahl', async () => {
    beitraege = [beitrag(3, 'approved'), beitrag(4, 'hidden')];
    const { container } = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain('Beitrag 3'));
    expect(knopf(container, 'pending').textContent).toBe('Wartet');
    expect(knopf(container, 'pending').querySelector('.app-segment-zahl')).toBeNull();
  });

  it('dasselbe Bauteil wie der Umschalter Aktuell/Geplant/Archiv, keine Abschrift', () => {
    const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
    const modal = lies('src/components/admin/modals/ChallengeLeitungModal.tsx');
    const liste = lies('src/components/admin/views/ChallengesManageView.tsx');
    expect(modal).toContain("import SegmentZahl from '../../shared/SegmentZahl'");
    expect(liste).toContain("import SegmentZahl from '../../shared/SegmentZahl'");
    expect(modal).toContain('<SegmentZahl anzahl={counts.pending} label={wartenAufFreigabeKurz(counts.pending)} />');
    // Keine eigene Fassung der Klasse im Modal.
    expect(modal).not.toContain('app-segment-zahl');
  });

  it('geht beim Freigeben sofort mit -- auch bevor die Liste nachgeladen ist', async () => {
    const { container, getByLabelText, getAllByLabelText } = await oeffnen();
    // Ab jetzt haengt das Nachladen: Die Zahl darf sich nur durch die
    // Aktion selbst aendern.
    apiGet.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(getByLabelText('Wartet: 2 anzeigen'));
    await waitFor(() => expect(getAllByLabelText('Freigeben').length).toBe(2));
    fireEvent.click(getAllByLabelText('Freigeben')[0]);

    await waitFor(() => {
      expect(knopf(container, 'pending').querySelector('.app-segment-zahl')?.textContent).toBe('1');
    });
    expect(apiPut).toHaveBeenCalledTimes(1);
    expect(knopf(container, 'pending').querySelector('.app-segment-zahl')?.getAttribute('aria-label')).toBe('1 wartet auf Freigabe');
  });

  it('geht beim Ablehnen sofort mit -- beim letzten verschwindet sie', async () => {
    beitraege = [beitrag(1, 'pending'), beitrag(3, 'approved')];
    const { container, getByLabelText } = await oeffnen();
    expect(knopf(container, 'pending').querySelector('.app-segment-zahl')?.textContent).toBe('1');
    apiGet.mockImplementation(() => new Promise(() => {}));

    fireEvent.click(getByLabelText('Wartet: 1 anzeigen'));
    await waitFor(() => expect(getByLabelText('Ausblenden')).not.toBeNull());
    fireEvent.click(getByLabelText('Ausblenden'));

    await waitFor(() => {
      expect(knopf(container, 'pending').querySelector('.app-segment-zahl')).toBeNull();
    });
    expect(apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/1/moderate', { action: 'hide' });
  });
});
