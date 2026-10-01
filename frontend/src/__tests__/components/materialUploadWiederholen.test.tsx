// Material: Kommt die Datei nicht an, legt ein zweites Speichern kein zweites
// Material an (30.09.2026).
//
// Tester-Rueckmeldung Build 130: PDF und Word "lassen sich bei Material nicht
// speichern -- vom Handy aus". Beim NEUEN Material legt das Formular zuerst
// den Eintrag an (POST /material) und laedt danach die Dateien hoch. Scheiterte
// der Upload, war das Material schon da -- das Formular wusste es aber nicht:
// Es meldete "Fehler beim Speichern", und jedes weitere Speichern legte ein
// weiteres Material an, jeweils ohne Datei. Jetzt merkt es sich das angelegte
// Material, speichert beim naechsten Mal dorthin und sagt, was fehlt.
//
// Gerendert wird das echte Formular; gestellt sind Server, Dateiauswahl und
// Netz. Das Titelfeld ist ein schlichtes <input>: ionInput erreicht in jsdom
// die React-Handler nicht (siehe anmeldeseitenBarrierefrei.test.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiPost = vi.fn();
const apiPut = vi.fn(async (..._a: unknown[]) => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    post: (...a: unknown[]) => apiPost(...a),
    put: (...a: unknown[]) => apiPut(...a),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT' }, triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));
const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, organization_id: 1, role_name: 'admin' }, setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: vi.fn() }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));

const brief = new File(['%PDF-1.7 Elternbrief'], 'Elternbrief.pdf', { type: 'application/pdf' });
vi.mock('../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../services/systemDialoge')>()),
  dateiAuswaehlen: vi.fn(async () => [brief]),
}));

vi.mock('@ionic/react', async (original) => {
  const echt = await original<typeof import('@ionic/react')>();
  const Eingabe = ({ label, value, onIonInput }: { label?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void }) => (
    <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
  );
  return { ...echt, IonInput: Eingabe };
});

import MaterialFormModal from '../../components/admin/modals/MaterialFormModal';

// Wie axios bei einem abgebrochenen Upload: kein response.
const netzabbruch = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });

beforeEach(() => {
  vi.clearAllMocks();
  apiPost.mockReset();
});
afterEach(() => cleanup());

async function neuesMaterialMitDatei() {
  const onSuccess = vi.fn();
  const ansicht = render(<MaterialFormModal onClose={vi.fn()} onSuccess={onSuccess} />);
  await act(async () => {
    fireEvent.change(ansicht.getByLabelText('Titel'), { target: { value: 'Elternabend' } });
  });
  await act(async () => { fireEvent.click(ansicht.getByText('Datei auswählen')); });
  await waitFor(() => expect(ansicht.getByText('Elternbrief.pdf')).toBeTruthy());
  const speichern = () => act(async () => {
    fireEvent.click(ansicht.container.querySelector('[aria-label="Material speichern"]')!);
  });
  return { ansicht, onSuccess, speichern };
}

describe('Material: Datei kam nicht an', () => {
  it('ein zweites Speichern laedt in DASSELBE Material hoch statt ein neues anzulegen', async () => {
    let versuche = 0;
    apiPost.mockImplementation(async (route: string) => {
      if (route === '/material') return { data: { id: 9 } };
      if (route === '/material/9/files') {
        versuche += 1;
        if (versuche === 1) throw netzabbruch();
        return { data: [] };
      }
      throw new Error(`unerwartet: ${route}`);
    });
    const { onSuccess, speichern } = await neuesMaterialMitDatei();

    await speichern();
    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();

    await speichern();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const routen = apiPost.mock.calls.map((c) => c[0]);
    expect(routen).toEqual(['/material', '/material/9/files', '/material/9/files']);
    // Beim zweiten Mal werden Titel & Co. am angelegten Material gespeichert.
    expect(apiPut).toHaveBeenCalledTimes(1);
    expect(apiPut.mock.calls[0][0]).toBe('/material/9');
    const zweiterUpload = apiPost.mock.calls[2][1] as FormData;
    expect((zweiterUpload.getAll('files') as File[]).map((d) => d.name)).toEqual(['Elternbrief.pdf']);
  });

  it('sagt, dass das Material steht und die Datei fehlt -- statt nur "Fehler beim Speichern"', async () => {
    apiPost.mockImplementation(async (route: string) => {
      if (route === '/material') return { data: { id: 9 } };
      throw netzabbruch();
    });
    const { speichern } = await neuesMaterialMitDatei();
    await speichern();
    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError).toHaveBeenCalledWith(
      'Das Material ist gespeichert, die Dateien noch nicht. Tippe noch einmal auf Speichern.',
      { ort: 'material-dateien-hochladen', fehler: expect.objectContaining({ code: 'ERR_NETWORK' }) },
    );
  });

  it('gibt der Messung Ort und Fehler mit -- daraus wird die Ursache (netz, timeout, Status)', async () => {
    // Android, 01.10.2026: Ohne Fehlerobjekt kam nur der Ersatztext an, nicht
    // WARUM der Upload scheiterte (services/uploadDiagnose.ts).
    const zeitgrenze = Object.assign(new Error('timeout of 180000ms exceeded'), { isAxiosError: true, code: 'ECONNABORTED' });
    apiPost.mockImplementation(async (route: string) => {
      if (route === '/material') return { data: { id: 9 } };
      throw zeitgrenze;
    });
    const { speichern } = await neuesMaterialMitDatei();
    await speichern();
    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError.mock.calls[0][1]).toEqual({ ort: 'material-dateien-hochladen', fehler: zeitgrenze });
  });

  it('scheitert schon das Anlegen, bleibt es bei "Fehler beim Speichern" -- und es gibt nichts zu merken', async () => {
    apiPost.mockImplementationOnce(async () => { throw netzabbruch(); });
    const { speichern } = await neuesMaterialMitDatei();
    await speichern();
    await waitFor(() => expect(setError).toHaveBeenCalledWith(
      'Fehler beim Speichern',
      { ort: 'material-speichern', fehler: expect.objectContaining({ code: 'ERR_NETWORK' }) },
    ));

    apiPost.mockImplementation(async (route: string) => (route === '/material' ? { data: { id: 11 } } : { data: [] }));
    await speichern();
    await waitFor(() => expect(apiPost.mock.calls.map((c) => c[0])).toEqual(['/material', '/material', '/material/11/files']));
    expect(apiPut).not.toHaveBeenCalled();
  });
});

void React;
