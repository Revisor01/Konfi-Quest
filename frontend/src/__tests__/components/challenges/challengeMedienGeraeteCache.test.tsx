import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { dateien, cacheInhalt, objectUrlAttrappe } from '../../medienAttrappen';

// Bilder und Dateien in Challenges bleiben auf dem Gerät (27.09.2026).
//
// Simon: "Wir brauchen bei den Bildern und Files in Challenges auch einen
// Geräte-Cache, sonst wird das alles immer wieder gelesen." Vorher hatten
// Konfi-Ansicht, Leitungsansicht und Rückblick-Folie je einen eigenen Lader
// ohne Cache: Jedes Öffnen einer Challenge lud jedes Foto neu.
//
// Gerendert werden die echten Ansichten mit dem echten Cache; gestellt sind
// Dateisystem (im Speicher), API (gezählt), Netz und die Ionic-Dialoge.

vi.mock('@capacitor/filesystem', async () => (await import('../../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
const apiDelete = vi.fn(async (..._args: unknown[]) => ({ data: {} }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

let online = true;
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return online; }, subscribe: () => () => undefined },
}));

vi.mock('../../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
  triggerPullHaptic: vi.fn(),
}));

vi.mock('../../../utils/nativeFileViewer', () => ({
  openFileNatively: vi.fn(async () => false),
}));

const stabil = { user: { id: 4, type: 'admin' }, setError: vi.fn(), setSuccess: vi.fn() };
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => stabil }));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ markChallengeAsRead: vi.fn() }) }));

// Ionic-Dialoge: Der Betrachter wird angezeigt, nicht gerendert (gezählt wird,
// was er bekäme); die Rückfrage beim Löschen wird sofort bestätigt.
type BetrachterProps = { files: Array<{ url: string; mimeType: string }>; initialIndex: number };
let betrachter: BetrachterProps | null = null;
const betrachterZeigen = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: (_k: unknown, props: BetrachterProps) => {
    if (props && 'files' in props) betrachter = props;
    return [betrachterZeigen, vi.fn()];
  },
  useIonAlert: () => [(optionen: { buttons: Array<{ role?: string; handler?: () => void }> }) => {
    optionen.buttons.find((b) => b.role === 'destructive')?.handler?.();
  }],
  useIonActionSheet: () => [vi.fn()],
}));

import ChallengeDetailModal from '../../../components/konfi/modals/ChallengeDetailModal';
import ChallengeLeitungModal from '../../../components/admin/modals/ChallengeLeitungModal';
import ChallengeMomenteSlide from '../../../components/wrapped/slides/ChallengeMomenteSlide';
import { clearMediaCache } from '../../../services/mediaCache';

class SofortSichtbar {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe = () => { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); };
  disconnect = () => undefined;
  unobserve = () => undefined;
  takeRecords = () => [];
}

const FOTO = '3a9616c3e76df800e7c1ac11bc3916802e09dd759f5be617675d8b4eeda1a3b3';
const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const challenge = {
  id: 5, title: 'Foto-Challenge', description: 'Zeig uns ein Bild', visibility: 'public',
  moderated: false, is_draft: false, allow_multiple: true, starts_at: vorZweiWochen, ends_at: inEinerWoche,
};
const beitrag = (id: number, pfad: string, name: string) => ({
  id, media_type: 'photo', file_path: pfad, file_name: name, text_content: 'Mein Bild',
  moderation_status: 'approved', created_at: vorZweiWochen, display_name: 'Test Konfi 2', user_id: 2,
});

let galerie: unknown[] = [];

const dateiAufrufe = () => apiGet.mock.calls.filter(([r]) => String(r).startsWith('/challenges/files/')).length;

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  // Der zuletzt geladene Stand der Listen (offlineCache) liegt im Browser in
  // localStorage — je Test frisch.
  localStorage.clear();
  online = true;
  apiGet.mockReset();
  apiDelete.mockClear();
  betrachterZeigen.mockReset();
  betrachter = null;
  galerie = [beitrag(1, FOTO, 'foto.png')];
  apiGet.mockImplementation(async (route: string) => {
    if (route.startsWith('/challenges/files/')) return { data: new Blob([`foto:${route}`], { type: 'image/png' }) };
    if (route === '/challenges/konfi/5') return { data: { challenge, gallery: galerie, own_submissions: [] } };
    if (route === '/challenges/admin/5/submissions') return { data: { challenge, submissions: galerie } };
    throw new Error(`unerwartet: ${route}`);
  });
  objectUrlAttrappe();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = SofortSichtbar;
});

afterEach(() => cleanup());

const oeffnen = async () => {
  const ansicht = render(<ChallengeDetailModal challenge={challenge as never} onClose={vi.fn()} />);
  await waitFor(() => expect(ansicht.container.querySelector('img[alt="foto.png"]')).not.toBeNull());
  return ansicht;
};

describe('Konfi-Ansicht: zweites Öffnen einer Challenge mit Bild', () => {
  it('fragt den Server beim zweiten Mal nur nach der Liste: 2 → 1 Aufruf', async () => {
    const erstes = await oeffnen();
    const beimErstenMal = apiGet.mock.calls.length;
    erstes.unmount();

    await oeffnen();
    const beimZweitenMal = apiGet.mock.calls.length - beimErstenMal;

    expect(beimErstenMal).toBe(2);
    expect(beimZweitenMal).toBe(1);
    expect(dateiAufrufe()).toBe(1);
  });

  it('auch nach einem Neustart kommt das Bild vom Gerät, nicht vom Server', async () => {
    (await oeffnen()).unmount();
    // Neustart: Speicher leer, die Datei liegt auf dem Gerät.
    const aufDemGeraet = new Map(dateien);
    await clearMediaCache();
    aufDemGeraet.forEach((d, p) => dateien.set(p, d));

    await oeffnen();

    expect(dateiAufrufe()).toBe(1);
  });

  it('ein Foto antippen öffnet es — ohne zweiten Download, mit den Fotos der Liste zum Wischen', async () => {
    galerie = [beitrag(1, FOTO, 'foto.png'), beitrag(2, 'bb22', 'zweites.jpg')];
    const { container } = await oeffnen();
    await waitFor(() => expect(container.querySelectorAll('img').length).toBe(2));

    await act(async () => {
      fireEvent.click(container.querySelector('[aria-label="Bild öffnen: foto.png"]')!);
    });

    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));
    expect(dateiAufrufe()).toBe(2);
    expect(betrachter!.files.map((f) => f.mimeType)).toEqual(['image/png', 'image/jpeg']);
    expect(betrachter!.initialIndex).toBe(0);
  });

  it('ausgeblendet oder gelöscht: steht nicht mehr in der Liste und kommt nicht aus dem Cache', async () => {
    (await oeffnen()).unmount();
    expect(cacheInhalt()).toEqual([`challenges-${FOTO}`]);

    // Die Leitung hat den Beitrag ausgeblendet: Der Server führt ihn nicht mehr.
    galerie = [];
    const zweites = render(<ChallengeDetailModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.container.textContent).toContain('Noch keine geteilten Beiträge'));

    expect(zweites.container.querySelector('img')).toBeNull();
    expect(dateiAufrufe()).toBe(1);
  });
});

describe('Leitungsansicht', () => {
  it('lädt über denselben Cache: zweites Öffnen ohne Datei-Download', async () => {
    const erstes = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(erstes.container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    erstes.unmount();

    const zweites = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.container.querySelector('img[alt="foto.png"]')).not.toBeNull());

    expect(dateiAufrufe()).toBe(1);
  });

  it('gelöscht: die Datei verschwindet auch vom Gerät', async () => {
    const { container } = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    expect(cacheInhalt()).toEqual([`challenges-${FOTO}`]);

    galerie = [];
    await act(async () => {
      fireEvent.click(container.querySelector('ion-item-option[aria-label="Endgültig löschen"]')!);
    });

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/challenges/admin/submissions/1'));
    await waitFor(() => expect(cacheInhalt()).toEqual([]));
  });
});

describe('Rückblick-Folie: der Server entscheidet', () => {
  const moment = {
    challenge_title: 'Foto-Challenge', badge_icon: 'flag', media_type: 'photo', file_path: FOTO,
    file_name: 'foto.png', text_content: null, link_url: null, created_at: vorZweiWochen,
  };

  it('zeigt das Foto über den gemeinsamen Lader', async () => {
    const { container } = render(<ChallengeMomenteSlide isActive momente={[moment] as never} />);

    await waitFor(() => expect(container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    expect(dateiAufrufe()).toBe(1);
  });

  it('der Beitrag wurde nach dem Rückblick gelöscht: kein Foto aus dem Cache, Datei weg', async () => {
    (render(<ChallengeMomenteSlide isActive momente={[moment] as never} />)).unmount();
    await waitFor(() => expect(cacheInhalt()).toEqual([`challenges-${FOTO}`]));
    apiGet.mockImplementation(async () => { throw Object.assign(new Error('404'), { response: { status: 404 } }); });

    const { container } = render(<ChallengeMomenteSlide isActive momente={[moment] as never} />);

    await waitFor(() => expect(container.textContent).toContain('Das Foto ist nicht mehr verfügbar.'));
    expect(container.querySelector('img')).toBeNull();
    expect(cacheInhalt()).toEqual([]);
  });
});

describe('Ohne Netz', () => {
  const netzWeg = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

  /** Wie nach einem Neustart: Speicher leer, die Dateien liegen auf dem Gerät. */
  const neustart = async () => {
    const aufDemGeraet = new Map(dateien);
    await clearMediaCache();
    aufDemGeraet.forEach((d, p) => dateien.set(p, d));
  };

  it('zeigt den zuletzt geladenen Stand mit dem Foto vom Gerät — ohne Server', async () => {
    (await oeffnen()).unmount();
    await neustart();
    online = false;
    apiGet.mockReset();
    apiGet.mockRejectedValue(netzWeg);

    const { container } = render(<ChallengeDetailModal challenge={challenge as never} onClose={vi.fn()} />);

    await waitFor(() => expect(container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    expect(dateiAufrufe()).toBe(0);
  });

  it('nie geladen: sagt, dass die Beiträge offline fehlen, statt "keine Beiträge"', async () => {
    online = false;
    apiGet.mockRejectedValue(netzWeg);

    const { container } = render(<ChallengeDetailModal challenge={challenge as never} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Die Liste der Beiträge ist offline nicht verfügbar.'));
    expect(container.textContent).not.toContain('Noch keine geteilten Beiträge');
  });

  it('antwortet der Server mit "kein Zugriff", gibt es keinen gespeicherten Stand', async () => {
    (await oeffnen()).unmount();
    apiGet.mockReset();
    apiGet.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403, data: { error: 'Zugriff verweigert' } } }));

    const { container } = render(<ChallengeDetailModal challenge={challenge as never} onClose={vi.fn()} />);

    await waitFor(() => expect(stabil.setError).toHaveBeenCalled());
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toContain('offline nicht verfügbar');
  });

  it('Leitungsansicht: dasselbe — Stand vom Gerät ohne Netz', async () => {
    const erstes = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);
    await waitFor(() => expect(erstes.container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    erstes.unmount();
    await neustart();
    online = false;
    apiGet.mockReset();
    apiGet.mockRejectedValue(netzWeg);

    const zweites = render(<ChallengeLeitungModal challenge={challenge as never} onClose={vi.fn()} />);

    await waitFor(() => expect(zweites.container.querySelector('img[alt="foto.png"]')).not.toBeNull());
    expect(dateiAufrufe()).toBe(0);
  });
});
