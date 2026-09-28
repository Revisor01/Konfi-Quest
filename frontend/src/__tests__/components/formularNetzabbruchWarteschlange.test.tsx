import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Funkloch, das die App nicht bemerkt (Audit Grundgeruest BF-01, Teil 2).
//
// Haelt sich die App fuer online, obwohl das Netz nicht traegt, nahm ein
// Formular den Online-Zweig: Anfrage -> Netzfehler -> Fehlermeldung. Eine
// Konfi im Bus, die eine Aktivitaet meldet, las "Fehler beim Einreichen"
// statt "Wird gesendet, sobald du wieder online bist" -- obwohl dieselbe
// Meldung offline laengst in die Warteschlange ging. Jetzt faellt ein
// Netzfehler im Online-Zweig in dieselbe Warteschlange
// (utils/sendenOderEinreihen.ts). Repraesentativ hier: das Konfi-Formular
// "Aktivitaet melden" (POST mit client_id, der Server erkennt den zweiten
// Eingang).

const mockApiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: (...a: unknown[]) => mockApiPost(...a) },
}));
const mockEnqueue = vi.fn(async () => ({ id: 'q1' }));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: (...a: unknown[]) => mockEnqueue(...(a as [])) },
}));
vi.mock('../../services/networkMonitor', () => ({
  // Die App haelt sich fuer ONLINE -- genau der Fall.
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));
vi.mock('../../services/mediaCompression', () => ({
  fuerUploadVorbereiten: vi.fn(),
  DateiZuGrossFehler: class extends Error {},
  UPLOAD_GRENZE: { nachweisfoto: 5 * 1024 * 1024 },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Data: 'DATA' },
}));
vi.mock('../../utils/uuid', () => ({ safeUUID: () => '6f1c2b1e-8a0d-4b43-9d6c-2f1f8b7e4a11' }));
vi.mock('../../services/analytics', () => ({ track: vi.fn() }));

const mockSetSuccess = vi.fn();
const mockSetError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, organization_id: 3, type: 'konfi' },
    setSuccess: mockSetSuccess,
    setError: mockSetError,
    isOnline: true,
  }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => Promise<unknown>) => fn() }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [{ id: 1, name: 'Gottesdienst besucht', points: 2, type: 'gottesdienst' }],
    loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));

// Ionic durch schlichte Elemente ersetzt; die Rueckfrage "Kein Foto" waehlt
// sofort "Ohne Foto fortfahren".
vi.mock('@ionic/react', async () => {
  const durch = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  const knopf = (p: { children?: React.ReactNode; onClick?: () => void; 'aria-label'?: string }) =>
    React.createElement('button', { onClick: p.onClick, 'aria-label': p['aria-label'] }, p.children);
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch,
    IonButtons: durch, IonButton: knopf, IonIcon: () => null, IonCard: durch, IonCardContent: durch,
    IonItem: durch, IonLabel: durch, IonTextarea: () => null, IonDatetime: () => null,
    IonDatetimeButton: () => null, IonModal: durch, IonProgressBar: () => null, IonList: durch,
    IonListHeader: durch, IonAccordion: durch, IonAccordionGroup: durch,
    useIonAlert: () => [(o: { buttons: Array<{ text: string; handler?: () => void }> }) =>
      o.buttons.find(b => b.text === 'Ohne Foto fortfahren')?.handler?.()],
  };
});

import ActivityRequestModal from '../../components/konfi/modals/ActivityRequestModal';

const config = { url: '/konfi/requests', method: 'post', headers: new AxiosHeaders() };
const netzfehler = () => new AxiosError('Network Error', 'ERR_NETWORK', config as never, {});

async function aktivitaetMelden() {
  const onSuccess = vi.fn();
  const ansicht = render(<ActivityRequestModal onClose={vi.fn()} onSuccess={onSuccess} />);
  fireEvent.click(ansicht.getByText('Gottesdienst besucht'));
  fireEvent.click(ansicht.getByLabelText('Aktivität absenden'));
  return onSuccess;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Aktivitaet melden, online, aber das Netz reisst ab', () => {
  it('landet in der Warteschlange statt in einer Fehlermeldung', async () => {
    mockApiPost.mockRejectedValueOnce(netzfehler());

    const onSuccess = await aktivitaetMelden();

    await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1));
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      url: '/konfi/requests',
      // Derselbe Idempotenzschluessel wie beim gescheiterten Versuch: Kam der
      // doch an, erkennt der Server den zweiten Eingang.
      body: expect.objectContaining({ activity_id: 1, client_id: '6f1c2b1e-8a0d-4b43-9d6c-2f1f8b7e4a11' }),
      metadata: expect.objectContaining({ type: 'request', label: 'Aktivität melden' }),
    }));
    expect(mockApiPost).toHaveBeenCalledWith('/konfi/requests', expect.objectContaining({
      client_id: '6f1c2b1e-8a0d-4b43-9d6c-2f1f8b7e4a11',
    }));
    expect(mockSetSuccess).toHaveBeenCalledWith('Aktivität wird gesendet sobald du wieder online bist');
    expect(mockSetError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('erlaubt, unveraendert: antwortet der Server mit einem Fehler, bleibt es bei der Meldung', async () => {
    mockApiPost.mockRejectedValueOnce(new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST',
      config as never, {}, { status: 400, statusText: '', headers: {}, config, data: { error: 'Aktivität nicht gefunden' } } as never));

    const onSuccess = await aktivitaetMelden();

    await waitFor(() => expect(mockSetError).toHaveBeenCalledWith('Aktivität nicht gefunden'));
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('erlaubt, unveraendert: mit Netz geht die Meldung direkt hinaus', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 5 } });

    const onSuccess = await aktivitaetMelden();

    await waitFor(() => expect(mockSetSuccess).toHaveBeenCalledWith('Aktivität erfolgreich eingereicht!'));
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

// Die uebrigen Formulare mit Warteschlange nutzen dieselbe Hilfsfunktion.
// Geprueft am Quelltext: dass sie sie rufen, mit welcher Methode und -- bei
// POST -- mit ausdruecklicher Zusicherung. Die Regel selbst pruefen die
// Tests der Hilfsfunktion (utils/sendenOderEinreihen.test.ts).
const lies = (pfad: string) => readFileSync(resolve(process.cwd(), 'src/components', pfad), 'utf8');

describe('Formulare mit Warteschlange fallen bei Netzabbruch in sie zurueck', () => {
  const faelle: Array<[string, string, string]> = [
    ['konfi/views/EventDetailView.tsx', "url: `/konfi/events/${eventData.id}/opt-out`", "methode: 'POST'"],
    ['konfi/views/EventDetailView.tsx', "url: `/konfi/events/${eventData.id}/register`", "methode: 'DELETE'"],
    ['konfi/modals/ActivityRequestModal.tsx', "url: '/konfi/requests'", "methode: 'POST'"],
    ['konfi/views/ProfileView.tsx', "url: '/konfi/bible-translation'", "methode: 'PUT'"],
    ['teamer/modals/TeamerActivityRequestModal.tsx', "url: '/teamer/requests'", "methode: 'POST'"],
    ['teamer/pages/TeamerEventsPage.tsx', "url: `/teamer/events/${event.id}/zusage`", "methode: 'POST'"],
    ['teamer/pages/TeamerProfilePage.tsx', "url: '/teamer/bible-translation'", "methode: 'PUT'"],
  ];

  it.each(faelle)('%s -- %s', (datei, url, methode) => {
    const inhalt = lies(datei);
    expect(inhalt).toContain('sendenOderEinreihen(');
    expect(inhalt).toContain(url);
    expect(inhalt).toContain(methode);
  });

  it('jeder POST, der nach einem Abbruch eingereiht werden darf, traegt die Zusicherung mit Begruendung', () => {
    for (const datei of ['konfi/views/EventDetailView.tsx', 'konfi/modals/ActivityRequestModal.tsx',
      'teamer/modals/TeamerActivityRequestModal.tsx', 'teamer/pages/TeamerEventsPage.tsx']) {
      expect(lies(datei), datei).toContain('idempotent: true');
    }
  });

  it('verboten: Bonuspunkte (POST ohne Idempotenzschluessel) fallen nach einem Abbruch NICHT in die Warteschlange', () => {
    const bonus = lies('admin/modals/BonusModal.tsx');
    expect(bonus).not.toContain('idempotent: true');
  });
});
