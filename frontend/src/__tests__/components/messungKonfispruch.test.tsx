/**
 * Welche Konfisprüche gewählt werden -- über die Nutzungsmessung, nicht über
 * die App (Simon, 10.10.2026: „Raus aus der App. Nur Umami!" und „Aber nicht
 * doppelt zählen."). docs/messung/umami.md, S1.
 *
 *   - `konfispruch-erste-wahl`  vorher stand kein Spruch da;
 *   - `konfispruch-gewechselt`   ein anderer Spruch ersetzt den alten, mit
 *                               `vorher_*` für den alten;
 *   - unverändert erneut gespeichert: nichts.
 *
 * Gerendert geprüft, bis an den Versand: Die echte Messung läuft (PROD an,
 * fetch abgefangen), geprüft wird die Nutzlast, die an Umami ginge -- erst
 * nach der Antwort des PATCH, nichts bei einem Fehler, Konfi und Team über
 * dieselbe Stelle, der Vorher-Stand aus der Anzeige (kein eigener Abruf).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => {
  // Vor dem Laden von services/analytics: Die Messung ist nur in PROD an.
  vi.stubEnv('PROD', true);
  return { fetch: vi.fn(), aktiv: null as number | null };
});
vi.stubGlobal('fetch', h.fetch);

const mockApiGet = vi.fn();
const mockApiPatch = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    isOnline: true,
    user: { id: 4711, display_name: 'Emilia Mustermann', username: 'emilia', organization: 'Kirchengemeinde Heide', organization_id: 3 },
    // GET /auth/my-organizations: Stamm-Gemeinde 3 mit Zuordnung, dazu eine zweite.
    activeOrgId: h.aktiv,
    organizations: [
      { id: 3, name: 'heide', display_name: 'Kirchengemeinde Heide', role_name: 'konfi', is_primary: true, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche' },
      { id: 9, name: 'andere', display_name: 'Andere', role_name: 'konfi', is_primary: false, kirchenkreis: 'Plön', landeskirche: 'Nordkirche' },
    ],
  }),
}));

// JSDOM reicht ionChange nicht an React durch (siehe pushAuswahl.test.tsx):
// die Leisten werden durch schlichte Knoepfe mit denselben Props ersetzt.
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const R = await vi.importActual<typeof import('react')>('react');
  type Knopf = { value: string; children?: React.ReactNode; waehlen?: () => void };
  const IonSegmentButton = (p: Knopf) => R.createElement('button', { type: 'button', 'data-segment': p.value, onClick: p.waehlen }, p.children);
  const IonSegment = (p: { onIonChange?: (e: { detail: { value: string } }) => void; children?: React.ReactNode }) =>
    R.createElement('div', null, R.Children.map(p.children, (kind) =>
      R.isValidElement<Knopf>(kind)
        ? R.cloneElement(kind, { waehlen: () => p.onIonChange?.({ detail: { value: kind.props.value } }) })
        : kind));
  return { ...echt, IonSegment, IonSegmentButton };
});

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));

import KonfispruchSelectModal from '../../components/konfi/modals/KonfispruchSelectModal';

const SPRUECHE = [
  {
    id: 11, reference: 'Josua 1,9', book: 'Josua', chapter: 1, verse: 9,
    uebersetzungen: { luther2017: 'Sei getrost und unverzagt.', gute_nachricht: 'Sei mutig und entschlossen!', bigs: '', elberfelder: '' },
  },
  {
    id: 12, reference: 'Psalm 23,1', book: 'Psalm', chapter: 23, verse: 1,
    uebersetzungen: { luther2017: 'Der HERR ist mein Hirte.', gute_nachricht: 'Der HERR ist mein Hirt.', bigs: '', elberfelder: '' },
  },
];

/** Die Ereignisse, die an Umami gegangen wären: [name, data]. */
const gesendet = (): Array<[string, Record<string, string>]> =>
  h.fetch.mock.calls.map((c) => {
    const p = (JSON.parse((c[1] as { body: string }).body) as { payload: { name: string; data: Record<string, string> } }).payload;
    return [p.name, p.data];
  });

/** Ein PATCH, dessen Antwort der Test selbst freigibt. */
const offenerPatch = () => {
  let ok: (v: unknown) => void = () => {};
  let nein: (e: unknown) => void = () => {};
  mockApiPatch.mockImplementation(() => new Promise((a, b) => { ok = a; nein = b; }));
  return { antworten: () => ok({ data: {} }), scheitern: (e: unknown) => nein(e) };
};

const speichern = async () => {
  // Ionic verschiebt aria-label beim Hydrieren ins Schatten-DOM; der Knopf
  // ist deshalb über seine Klasse zu finden.
  const knopf = document.body.querySelector('ion-button.app-modal-submit-btn');
  expect(knopf).not.toBeNull();
  await act(async () => { fireEvent.click(knopf as HTMLElement); });
};

const zeigen = async (props: Record<string, unknown> = {}) => {
  const onSuccess = vi.fn();
  render(<KonfispruchSelectModal onClose={vi.fn()} onSuccess={onSuccess} {...props} />);
  await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
  if (props.current === undefined || (props.current as { source?: string })?.source !== 'freitext') {
    await screen.findByText('Josua 1,9');
  }
  return { onSuccess };
};

beforeEach(() => {
  cleanup();
  mockApiGet.mockReset().mockResolvedValue({ data: SPRUECHE });
  mockApiPatch.mockReset();
  h.fetch.mockReset().mockResolvedValue({ ok: true });
  h.aktiv = null;
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Konfispruch aus den Vorschlägen', () => {
  it('erste Wahl: genau ein Ereignis, erst nach der Antwort, mit Spruch und Gemeinde', async () => {
    const patch = offenerPatch();
    const { onSuccess } = await zeigen();
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    expect(mockApiPatch.mock.calls[0]).toEqual(['/konfi/profile', { konfspruch_id: 11, translation: 'luther2017' }]);
    expect(h.fetch).not.toHaveBeenCalled();

    await act(async () => { patch.antworten(); });

    expect(gesendet()).toEqual([
      ['konfispruch-erste-wahl', {
        quelle: 'vorschlag', spruch: 'Josua 1,9', spruch_id: '11', bibel: 'luther', gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
      }],
    ]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Nichts von der Person: weder Name noch Benutzername noch Kennung.
    const rumpf = h.fetch.mock.calls.map((c) => (c[1] as { body: string }).body).join('\n');
    for (const verboten of ['Emilia', 'Mustermann', 'emilia', '4711', 'organization_id']) {
      expect(rumpf, `${verboten} steht im Rumpf`).not.toContain(verboten);
    }
  });

  it('gleicher Spruch erneut gespeichert: kein Ereignis', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await zeigen({ current: { source: 'liste', id: 11, reference: 'Josua 1,9', translation: 'luther2017' } });
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(gesendet()).toEqual([]);
  });

  it('Wechsel: genau ein Ereignis gewechselt, mit dem alten Spruch in vorher_*', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await zeigen({ current: { source: 'liste', id: 11, reference: 'Josua 1,9', translation: 'gute_nachricht' } });
    await act(async () => { fireEvent.click(screen.getByText('Psalm 23,1')); });
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(gesendet()).toEqual([
      ['konfispruch-gewechselt', {
        quelle: 'vorschlag', spruch: 'Psalm 23,1', spruch_id: '12', bibel: 'gute-nachricht',
        vorher_quelle: 'vorschlag', vorher_spruch: 'Josua 1,9', vorher_spruch_id: '11', vorher_bibel: 'gute-nachricht',
        gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
      }],
    ]);
  });

  it('scheitert das Speichern, wird nichts gemeldet', async () => {
    const patch = offenerPatch();
    const { onSuccess } = await zeigen();
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    await act(async () => { patch.scheitern({ response: { status: 404, data: {} } }); });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(gesendet()).toEqual([]);
  });

  it('beim Team dieselbe Stelle (PATCH /teamer/profile), dasselbe Ereignis', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    await zeigen({ apiBasePath: '/teamer', variant: 'teamer' });
    await act(async () => { fireEvent.click(screen.getByText('Psalm 23,1')); });
    await speichern();

    await waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(1));
    expect(mockApiPatch.mock.calls[0][0]).toBe('/teamer/profile');
    expect(gesendet()).toEqual([
      ['konfispruch-erste-wahl', {
        quelle: 'vorschlag', spruch: 'Psalm 23,1', spruch_id: '12', bibel: 'luther', gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
      }],
    ]);
  });
});

describe('Gemeinde, Kirchenkreis und Landeskirche', () => {
  it('kommen aus der AKTIVEN Gemeinde, nicht aus der Stamm-Gemeinde', async () => {
    h.aktiv = 9;
    mockApiPatch.mockResolvedValue({ data: {} });
    await zeigen();
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    await waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(1));
    expect(gesendet()).toEqual([
      ['konfispruch-erste-wahl', {
        quelle: 'vorschlag', spruch: 'Josua 1,9', spruch_id: '11', bibel: 'luther',
        gemeinde: 'Andere', kirchenkreis: 'Plön', landeskirche: 'Nordkirche',
      }],
    ]);
  });
});

describe('Eigener Konfispruch', () => {
  it('unverändert gespeichert: kein Ereignis', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await zeigen({ current: { source: 'freitext', text: 'Ich bin bei dir', reference: 'Mt 28,20' } });
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockApiPatch.mock.calls[0]).toEqual([
      '/konfi/profile',
      { konfspruch_freitext: 'Ich bin bei dir', konfspruch_freitext_referenz: 'Mt 28,20' },
    ]);
    expect(gesendet()).toEqual([]);
  });

  it('vom eigenen Spruch zurück zu einem Vorschlag: gewechselt mit dem Wortlaut in vorher_spruch', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await zeigen({ current: { source: 'freitext', text: 'Ich bin bei dir', reference: 'Mt 28,20' } });
    // Umschalten auf „Aus der Liste" und einen Vorschlag wählen.
    const liste = document.body.querySelector('button[data-segment="liste"]');
    expect(liste).not.toBeNull();
    await act(async () => { fireEvent.click(liste as HTMLElement); });
    await screen.findByText('Josua 1,9');
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(gesendet()).toEqual([
      ['konfispruch-gewechselt', {
        quelle: 'vorschlag', spruch: 'Josua 1,9', spruch_id: '11', bibel: 'luther',
        vorher_quelle: 'eigen', vorher_spruch: 'Ich bin bei dir', vorher_stelle: 'Mt 28,20',
        gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
      }],
    ]);
  });
});
