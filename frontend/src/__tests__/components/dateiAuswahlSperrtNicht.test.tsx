import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react';

// Die Dateiauswahl löst die App-Sperre nicht aus (Simons Befund 29.09.2026,
// Android-Testbuild 128: „Dateiauswahl ist auch noch nicht als Ausnahme beim
// Biometrie öffnen.").
//
// Auf Android geht die Auswahl des Systems in einer eigenen Activity auf; die
// App meldet dabei appStateChange { isActive: false } und bei der Rückkehr
// { isActive: true }. Bei „Sofort" sperrt JEDER solche Wechsel — außer, ein
// Ausflug ist angemeldet. Der Chat öffnete sein verstecktes Datei-Feld ohne
// Ausflug: Nach jeder Auswahl kam die Fingerabdruck-Abfrage.
//
// Echt sind hier: der Sperr-Hook, der Ausflug-Merker, die Hülle, der
// Datei-Hook des Chats und das Eingabefeld des Chats mit seinem Knopf.
// Gestellt: die Plattform (nativ), das App-Plugin (Wechsel von Hand), die
// Einstellung („Sofort"), die Biometrie (vorhanden).

let zustandsWechsel: ((e: { isActive: boolean }) => void) | null = null;

vi.mock('@capacitor/core', async (original) => {
  const echt = await original<typeof import('@capacitor/core')>();
  return {
    ...echt,
    Capacitor: { ...echt.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_name: string, cb: (e: { isActive: boolean }) => void) => {
      zustandsWechsel = cb;
      return { remove: vi.fn() };
    }),
  },
}));

vi.mock('../../services/appSperre', async () => {
  const echt = await vi.importActual<typeof import('../../services/appSperre')>('../../services/appSperre');
  return {
    ...echt,
    sperreVerfuegbar: async () => true,
    sperreLesen: async () => 'sofort',
  };
});

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../hooks/useDateiOeffnen', () => ({
  useDateiOeffnen: () => ({ dateiOeffnen: vi.fn(), ladendeDatei: null }),
}));

import { useAppSperre } from '../../hooks/useAppSperre';
import { useChatDateien } from '../../components/chat/useChatDateien';
import { MessageInput } from '../../components/chat/ChatRoomSections';
import { laeuftAusflug, ausflugBeenden } from '../../services/appSperre';
import { AUSWAHL_NACHLAUF_MS } from '../../services/systemDialoge';

const echterKlick = HTMLInputElement.prototype.click;
let geoeffnet: HTMLInputElement[] = [];
const offenesFeld = (): HTMLInputElement | undefined => geoeffnet[geoeffnet.length - 1];
let ausflugBeimOeffnen: boolean | null = null;

// Wie ChatRoom den Chat verdrahtet: Datei-Hook + Eingabefeld.
const Chat: React.FC = () => {
  const { gesperrt, entsperren } = useAppSperre();
  const { selectedFile, selectedFilePreview, dateiWaehlen, clearSelectedFile } = useChatDateien({ messages: [] });
  const textareaRef = useRef<HTMLIonTextareaElement>(null);
  return (
    <div>
      <span data-testid="zustand">{gesperrt ? 'gesperrt' : 'offen'}</span>
      <button onClick={entsperren}>entsperren</button>
      <MessageInput
        messageText=""
        uploading={false}
        selectedFile={selectedFile}
        selectedFilePreview={selectedFilePreview}
        replyToMessage={null}
        textareaRef={textareaRef}
        onTextChange={vi.fn()}
        onFocus={vi.fn()}
        onSend={vi.fn()}
        onDateiWaehlen={dateiWaehlen}
        onClearFile={clearSelectedFile}
        onClearReply={vi.fn()}
      />
    </div>
  );
};

const zustand = () => screen.getByTestId('zustand').textContent;

/** Kaltstart bei „Sofort" sperrt — erst entsperren, dann geht es los. */
const offenerChat = async () => {
  const ansicht = render(<Chat />);
  await waitFor(() => expect(zustand()).toBe('gesperrt'));
  await waitFor(() => expect(zustandsWechsel).not.toBeNull());
  fireEvent.click(screen.getByText('entsperren'));
  expect(zustand()).toBe('offen');
  return ansicht;
};

const wegUndZurueck = async (dazwischen: () => void) => {
  await act(async () => { zustandsWechsel!({ isActive: false }); });
  await act(async () => { dazwischen(); });
  await act(async () => { zustandsWechsel!({ isActive: true }); });
};

beforeEach(() => {
  vi.clearAllMocks();
  zustandsWechsel = null;
  geoeffnet = [];
  ausflugBeimOeffnen = null;
  URL.createObjectURL = vi.fn(() => 'blob:vorschau');
  URL.revokeObjectURL = vi.fn();
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
    geoeffnet.push(this);
    ausflugBeimOeffnen = laeuftAusflug();
  };
});

afterEach(async () => {
  cleanup();
  HTMLInputElement.prototype.click = echterKlick;
  await new Promise((weiter) => setTimeout(weiter, AUSWAHL_NACHLAUF_MS + 20));
  while (laeuftAusflug()) ausflugBeenden();
});

describe('Chat: eine Datei anhängen sperrt die App nicht', () => {
  it('Auswahl über die Systemauswahl von Android, zurück in die App: offen, Datei da', async () => {
    await offenerChat();

    await act(async () => { fireEvent.click(screen.getByLabelText('Datei anhängen')); });
    expect(geoeffnet).toHaveLength(1);
    expect(offenesFeld()!.type).toBe('file');
    expect(ausflugBeimOeffnen).toBe(true);

    const plan = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' });
    await wegUndZurueck(() => {
      Object.defineProperty(offenesFeld()!, 'files', { value: [plan], configurable: true });
      offenesFeld()!.onchange?.(new Event('change'));
    });

    expect(zustand()).toBe('offen');
    await waitFor(() => expect(screen.getByText('plan.pdf')).toBeTruthy());
  });

  it('Abbruch in der Systemauswahl, zurück in die App: offen', async () => {
    await offenerChat();

    await act(async () => { fireEvent.click(screen.getByLabelText('Datei anhängen')); });
    await wegUndZurueck(() => { offenesFeld()!.oncancel?.(new Event('cancel')); });

    expect(zustand()).toBe('offen');
  });

  it('nach dem Nachlauf ist die Sperre wieder scharf: ein echter Wechsel sperrt', async () => {
    await offenerChat();
    await act(async () => { fireEvent.click(screen.getByLabelText('Datei anhängen')); });
    await wegUndZurueck(() => { offenesFeld()!.oncancel?.(new Event('cancel')); });

    await waitFor(() => expect(laeuftAusflug()).toBe(false), { timeout: AUSWAHL_NACHLAUF_MS * 2 });
    await wegUndZurueck(() => undefined);

    expect(zustand()).toBe('gesperrt');
  });

  it('GEGENPROBE: ein Datei-Feld an der Hülle vorbei sperrt — genau der Befund', async () => {
    await offenerChat();

    // So öffnete der Chat die Auswahl bis zum 29.09.2026.
    const feld = document.createElement('input');
    feld.setAttribute('type', 'file');
    feld.click();
    expect(ausflugBeimOeffnen).toBe(false);
    await wegUndZurueck(() => undefined);

    expect(zustand()).toBe('gesperrt');
  });
});
