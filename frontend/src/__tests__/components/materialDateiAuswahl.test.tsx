// Simons Befund 04.09.2026: "Material kann nicht hochgeladen werden, im
// Browser geht nichts." Sein Netz-Mitschnitt zeigte den PUT auf
// /material/:id, aber KEINEN POST auf /material/:id/files -- die Datei kam
// nie im State an.
//
// Ursache: Array.from(e.target.files) stand INNERHALB des
// setNewFiles(prev => ...)-Updaters. React ruft den verzoegert auf; bis
// dahin hatte die Zeile darunter (fileInputRef.current.value = '') den
// Input geleert.
//
// Seit dem 29.09.2026 oeffnet das Modal die Auswahl ueber die Huelle
// dateiAuswaehlen (services/systemDialoge, wegen der App-Sperre). Die liest
// das Feld aus, BEVOR sie es leert, und legt je Auswahl ein frisches an --
// beides ist dort im Ablauf geprueft (dateiAuswahl.test.ts).
//
// Seit dem 09.10.2026 gerendert (vorher Quelltext): Das echte Formular holt
// die Liste aus der Huelle, zeigt jede gewaehlte Datei und laedt genau sie
// hoch -- der Fall aus Simons Mitschnitt (PUT ohne POST) faellt hier auf.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { knopf } from '../medienAttrappen';

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

// Die Huelle liefert, was der Test vorgibt -- je Aufruf eine Antwort.
const auswahl = vi.fn<(optionen: unknown) => Promise<File[] | null>>();
vi.mock('../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../services/systemDialoge')>()),
  dateiAuswaehlen: (optionen: unknown) => auswahl(optionen),
}));

vi.mock('@ionic/react', async (original) => {
  const echt = await original<typeof import('@ionic/react')>();
  const Eingabe = ({ label, value, onIonInput }: { label?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void }) => (
    <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
  );
  return { ...echt, IonInput: Eingabe, useIonModal: () => [vi.fn(), vi.fn()], useIonAlert: () => [vi.fn(), vi.fn()] };
});

import MaterialFormModal from '../../components/admin/modals/MaterialFormModal';

const pdf = (name: string, bytes = 64) => new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
const MB = 1024 * 1024;

beforeEach(() => {
  vi.clearAllMocks();
  auswahl.mockReset();
  apiPost.mockReset();
  apiPost.mockImplementation(async (route: string) => (route === '/material' ? { data: { id: 9 } } : { data: [] }));
});
afterEach(() => cleanup());

async function formular() {
  const onSuccess = vi.fn();
  const ansicht = render(<MaterialFormModal onClose={vi.fn()} onSuccess={onSuccess} />);
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Elternabend' } });
  });
  return { ansicht, onSuccess };
}
const waehlen = async () => {
  await act(async () => { fireEvent.click(screen.getByText('Datei auswählen')); });
  // dateienVorbereiten laeuft nach der Auswahl weiter (Bilder verkleinern).
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
};
const speichern = async () => {
  await act(async () => { fireEvent.click(knopf(document.body, 'Material speichern')); });
};
const hochgeladen = () => {
  const upload = apiPost.mock.calls.find(([r]) => r === '/material/9/files');
  return upload ? (upload[1] as FormData).getAll('files').map((d) => (d as File).name) : null;
};

describe('Datei-Auswahl im Material-Modal', () => {
  it('holt die Liste aus der Hülle -- mehrere Dateien, mit der Auswahl fuer Material', async () => {
    auswahl.mockResolvedValueOnce([pdf('Plan.pdf'), pdf('Liste.pdf')]);
    await formular();
    await waehlen();
    expect(auswahl).toHaveBeenCalledTimes(1);
    expect(auswahl).toHaveBeenCalledWith({
      accept: 'image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp',
      multiple: true,
    });
    expect(screen.getByText('Plan.pdf')).toBeTruthy();
    expect(screen.getByText('Liste.pdf')).toBeTruthy();
  });

  it('reicht die fertige Liste weiter: genau die gewaehlten Dateien gehen hoch (Simons Fall: PUT/POST ohne Upload)', async () => {
    auswahl.mockResolvedValueOnce([pdf('Plan.pdf'), pdf('Liste.pdf')]);
    const { onSuccess } = await formular();
    await waehlen();
    await speichern();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls.map(([r]) => r)).toEqual(['/material', '/material/9/files']);
    expect(hochgeladen()).toEqual(['Plan.pdf', 'Liste.pdf']);
  });

  it('eine zweite Auswahl kommt dazu, statt die erste zu ersetzen', async () => {
    // Der Updater haengt die vorbereitete Liste an den vorigen Stand an.
    auswahl.mockResolvedValueOnce([pdf('Plan.pdf')]).mockResolvedValueOnce([pdf('Liste.pdf')]);
    const { onSuccess } = await formular();
    await waehlen();
    await waehlen();
    await speichern();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(hochgeladen()).toEqual(['Plan.pdf', 'Liste.pdf']);
  });

  it('hält kein eigenes Datei-Feld: im Formular steht kein <input type="file">', async () => {
    await formular();
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });

  it('nimmt nur auf, wenn wirklich etwas gewaehlt wurde: Abbruch (null) und leere Auswahl', async () => {
    auswahl.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    const { onSuccess } = await formular();
    await waehlen();
    await waehlen();
    expect(auswahl).toHaveBeenCalledTimes(2);
    expect(setError).not.toHaveBeenCalled();
    await speichern();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls.map(([r]) => r)).toEqual(['/material']);
  });

  it('eine Datei ueber der Grenze des Servers (20 MB) kommt nicht in die Liste und die Leitung erfaehrt, warum', async () => {
    auswahl.mockResolvedValueOnce([pdf('Riesig.pdf', 21 * MB), pdf('Klein.pdf')]);
    await formular();
    await waehlen();
    expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 20 MB).');
    expect(screen.queryByText('Riesig.pdf')).toBeNull();
    expect(screen.getByText('Klein.pdf')).toBeTruthy();
  });
});

describe('Andere Upload-Stellen lesen die Datei sofort aus (Waechter)', () => {
  // Bewusst Quelltext: Dieselbe Falle darf anderswo nicht schlummern -- ein
  // Muster, das in keiner Datei vorkommen soll.
  const dateien = [
    'src/components/konfi/modals/ChallengeSubmitModal.tsx',
    'src/components/konfi/modals/ActivityRequestModal.tsx',
    'src/components/teamer/modals/TeamerActivityRequestModal.tsx',
    'src/components/chat/useChatDateien.ts',
    'src/components/admin/modals/MaterialFormModal.tsx',
  ];

  it.each(dateien)('%s greift nicht verzoegert auf target.files zu', (pfad) => {
    const q = readFileSync(resolve(process.cwd(), pfad), 'utf8');
    // Kein target.files INNERHALB eines Updater-Callbacks (prev => ...).
    const treffer = [...q.matchAll(/set\w+\(\s*\w+\s*=>[\s\S]{0,200}?target\.files/g)];
    expect(treffer.length).toBe(0);
  });
});
