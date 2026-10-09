// Gerüst zuerst: es registriert die Attrappen, bevor der Raum geladen wird.
import {
  api, zustand, setError, nativOeffnen, betrachterZeigen,
  raumOeffnen, dateiWaehlen, senden, zuruecksetzen, aufgeschoben,
  dateiNachricht, datei,
} from './gerueste/chatRaumMitDateien';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, waitFor, within, cleanup } from '@testing-library/react';
import { send, paperPlane, paperPlaneOutline } from 'ionicons/icons';
import { ICON_SENDEN, ICON_SENDEN_GEFUELLT, ICON_UHRZEIT } from '../../components/shared/icons';
import type { Message } from '../../types/chat';

// Fortschrittsanzeige beim Senden und Laden von Dateien (11.09.2026).
//
// Vorher gab es beim Senden nur einen Spinner im Senden-Knopf und beim Laden
// gar keine Rueckmeldung: Wer eine PDF antippte, sah nichts passieren und
// tippte weiter — was mehrere Downloads parallel anstiess (Simon, 11.09.2026).
//
// Bis zum 09.10.2026 prueften diese Tests den Quelltext (die Anzeige haengt an
// axios-Ereignissen). Jetzt laeuft der echte Chatraum: Die Attrappe von axios
// ruft genau die Rueckrufe auf, die der Raum ihr mitgibt -- geprueft wird,
// was dann in der echten Sprechblase steht.

type Fortschritt = (e: { loaded: number; total?: number }) => void;

/** Das Senden-Versprechen des Servers anhalten und seinen Rueckruf holen. */
function sendenAnhalten() {
  const antwort = aufgeschoben<{ data: unknown }>();
  api.post.mockImplementationOnce(() => antwort.versprechen);
  const rueckruf = (): Fortschritt | undefined =>
    (api.post.mock.calls.at(-1)?.[2] as { onUploadProgress?: Fortschritt } | undefined)?.onUploadProgress;
  return { antwort, rueckruf };
}

/** Die Sprechblase, in der ein Text steht. */
const blase = (text: string) => screen.getByText(text).closest('.app-chat-nachricht') as HTMLElement;
const symbole = (el: HTMLElement) => [...el.querySelectorAll('i[data-icon]')].map((i) => i.getAttribute('data-icon'));

beforeEach(async () => { await zuruecksetzen(); });
afterEach(() => cleanup());

describe('Senden: der Fortschritt kommt von axios, nicht aus einer Schaetzung', () => {
  async function pdfSenden() {
    const { antwort, rueckruf } = sendenAnhalten();
    await raumOeffnen();
    await dateiWaehlen(datei('Plakat.pdf', 4000));
    await senden();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    return { antwort, fortschritt: rueckruf()! };
  }

  it('haengt den Fortschritt an onUploadProgress und rechnet aus geladenen und gesamten Bytes', async () => {
    const { fortschritt } = await pdfSenden();
    expect(typeof fortschritt).toBe('function');
    await act(async () => { fortschritt({ loaded: 30, total: 120 }); });
    const b = blase('Plakat.pdf');
    expect(within(b).getByText('Wird gesendet… 25 %')).toBeTruthy();
    const balken = within(b).getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('25');
  });

  it('zeigt keinen geratenen Wert, wenn der Server keine Groesse meldet', async () => {
    const { fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 30, total: 120 }); });
    await act(async () => { fortschritt({ loaded: 90 }); });
    expect(within(blase('Plakat.pdf')).getByText('Wird gesendet… 25 %')).toBeTruthy();
    expect(within(blase('Plakat.pdf')).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('setzt den Fortschritt nur bei einer Datei', async () => {
    const { antwort } = sendenAnhalten();
    await raumOeffnen();
    await senden();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect((api.post.mock.calls[0][2] as { onUploadProgress?: unknown }).onUploadProgress).toBeUndefined();
    const b = blase('Hallo');
    expect(within(b).queryByRole('progressbar')).toBeNull();
    expect(within(b).queryByText(/Wird gesendet/)).toBeNull();
    // Reiner Text wartet mit der Uhr wie jede ausstehende Nachricht.
    expect(symbole(b)).toContain(ICON_UHRZEIT);
    await act(async () => { antwort.loesen({ data: {} }); });
  });

  it('haengt den Fortschritt an die Nachricht, nicht an die Datei-Vorschau', async () => {
    // Gemessen am Geraet (11.09.2026): Die Auswahl wird VOR dem Upload
    // geleert, damit das Eingabefeld sofort frei ist -- ein Balken in der
    // Vorschauzeile waere nie zu sehen.
    const { fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 60, total: 120 }); });
    expect(screen.getByTestId('gewaehlt').textContent).toBe('');
    const balken = screen.getAllByRole('progressbar');
    expect(balken).toHaveLength(1);
    expect(blase('Plakat.pdf').contains(balken[0])).toBe(true);
  });

  it('raeumt den Fortschritt weg, wenn der Server antwortet', async () => {
    const { antwort, fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 60, total: 120 }); });
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    await act(async () => { antwort.loesen({ data: {} }); });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/Wird gesendet|Wird verarbeitet/)).toBeNull();
  });

  it('raeumt ihn auch weg, wenn das Senden scheitert', async () => {
    const { antwort, fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 60, total: 120 }); });
    await act(async () => { antwort.ablehnen({ message: 'Network Error' }); });
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.queryByText(/Wird gesendet|Wird verarbeitet/)).toBeNull();
  });

  it('ordnet den Fortschritt genau einer Nachricht zu', async () => {
    // Ohne den Vergleich zeigten ALLE eigenen Nachrichten den Balken.
    const wartend: Message = {
      id: -5, content: 'Noch von gestern', sender_id: 1, sender_name: 'Ich', sender_type: 'konfi',
      created_at: '2026-09-27T07:00:00Z', message_type: 'text', queueStatus: 'pending', localId: 'alt',
    };
    zustand.nachrichten = [wartend];
    const { fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 60, total: 120 }); });
    expect(within(blase('Noch von gestern')).queryByRole('progressbar')).toBeNull();
    expect(within(blase('Noch von gestern')).queryByText(/Wird gesendet/)).toBeNull();
    expect(within(blase('Plakat.pdf')).getByText('Wird gesendet… 50 %')).toBeTruthy();
  });

  it('ersetzt waehrend des Sendens das Uhr-Symbol', async () => {
    const wartend: Message = {
      id: -5, content: 'Noch von gestern', sender_id: 1, sender_name: 'Ich', sender_type: 'konfi',
      created_at: '2026-09-27T07:00:00Z', message_type: 'text', queueStatus: 'pending', localId: 'alt',
    };
    zustand.nachrichten = [wartend];
    await pdfSenden();
    expect(symbole(blase('Plakat.pdf'))).not.toContain(ICON_UHRZEIT);
    expect(within(blase('Plakat.pdf')).getByText('Wird gesendet… 0 %')).toBeTruthy();
    // Die andere wartende Nachricht behaelt ihre Uhr.
    expect(symbole(blase('Noch von gestern'))).toContain(ICON_UHRZEIT);
  });

  it('sagt bei 100 Prozent, dass noch verarbeitet wird, und geht nicht darueber', async () => {
    const { fortschritt } = await pdfSenden();
    await act(async () => { fortschritt({ loaded: 130, total: 120 }); });
    const b = blase('Plakat.pdf');
    expect(within(b).getByText('Wird verarbeitet…')).toBeTruthy();
    expect(within(b).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('Laden: eine angetippte Datei zeigt, dass sie laedt', () => {
  type Abruf = { onDownloadProgress?: Fortschritt };

  /** Den Download anhalten; liefert den Fortschritts-Rueckruf des Medien-Caches. */
  function ladenAnhalten() {
    const antwort = aufgeschoben<{ data: Blob }>();
    api.get.mockImplementationOnce(() => antwort.versprechen);
    const rueckruf = () => (api.get.mock.calls.at(-1)?.[1] as Abruf).onDownloadProgress!;
    return { antwort, rueckruf };
  }

  const zeile = (name: string) => screen.getByText(name).closest('[role="button"]') as HTMLElement;
  const antippen = async (name: string) => { await act(async () => { fireEvent.click(zeile(name)); }); };

  beforeEach(() => {
    zustand.nachrichten = [
      dateiNachricht(11, 'ab12', 'Plan.pdf', 2048),
      dateiNachricht(12, 'cd34', 'Liste.pdf', 3072),
    ];
  });

  it('laedt ueber den Chat-Pfad mit onDownloadProgress und nennt die Prozentzahl', async () => {
    const { rueckruf } = ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(api.get.mock.calls[0][0]).toBe('/chat/files/ab12');
    expect(within(zeile('Plan.pdf')).getByText('Wird geladen… 0 %')).toBeTruthy();
    await act(async () => { rueckruf()({ loaded: 40, total: 100 }); });
    const z = zeile('Plan.pdf');
    expect(within(z).getByText('Wird geladen… 40 %')).toBeTruthy();
    const balken = within(z).getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('40');
    expect(balken.getAttribute('aria-valuemin')).toBe('0');
    expect(balken.getAttribute('aria-valuemax')).toBe('100');
    expect(balken.getAttribute('aria-label')).toBe('Datei wird geladen: 40 Prozent');
  });

  it('laesst den Fortschritt bei unbekannter Groesse offen', async () => {
    const { rueckruf } = ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => { rueckruf()({ loaded: 40 }); });
    const z = zeile('Plan.pdf');
    expect(within(z).getByText('Wird geladen…')).toBeTruthy();
    expect(within(z).queryByRole('progressbar')).toBeNull();
  });

  it('nur die angetippte Datei zeigt den Fortschritt, die andere ihre Groesse', async () => {
    const { rueckruf } = ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => { rueckruf()({ loaded: 40, total: 100 }); });
    const andere = zeile('Liste.pdf');
    expect(within(andere).getByText('3 KB')).toBeTruthy();
    expect(within(andere).queryByText(/Wird geladen/)).toBeNull();
    expect(within(andere).queryByTestId('spinner')).toBeNull();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('ersetzt den Pfeil waehrend des Ladens durch einen Spinner', async () => {
    ladenAnhalten();
    await raumOeffnen();
    expect(within(zeile('Plan.pdf')).queryByTestId('spinner')).toBeNull();
    expect(within(zeile('Plan.pdf')).getByText('2 KB')).toBeTruthy();
    await antippen('Plan.pdf');
    await waitFor(() => expect(within(zeile('Plan.pdf')).getByTestId('spinner')).toBeTruthy());
    expect(within(zeile('Plan.pdf')).queryByText('2 KB')).toBeNull();
  });

  it('ignoriert einen zweiten Tipp, solange geladen wird', async () => {
    // Genau der gemeldete Fall: mehrfaches Tippen stiess mehrere Downloads an.
    ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await antippen('Plan.pdf');
    await antippen('Liste.pdf');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('raeumt die Anzeige weg, auch wenn die Datei nativ geoeffnet wurde', async () => {
    nativOeffnen.mockResolvedValue(true);
    const { antwort } = ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => { antwort.loesen({ data: new Blob(['pdf'], { type: 'application/pdf' }) }); });
    await waitFor(() => expect(nativOeffnen).toHaveBeenCalledTimes(1));
    expect(within(zeile('Plan.pdf')).getByText('2 KB')).toBeTruthy();
    expect(within(zeile('Plan.pdf')).queryByTestId('spinner')).toBeNull();
    expect(betrachterZeigen).not.toHaveBeenCalled();
  });

  it('raeumt die Anzeige weg und meldet es, wenn das Laden scheitert', async () => {
    const { antwort } = ladenAnhalten();
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await act(async () => { antwort.ablehnen(new Error('weg')); });
    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError.mock.calls[0][0]).toBe('Fehler beim Öffnen der Datei');
    expect(within(zeile('Plan.pdf')).getByText('2 KB')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('zeigt beim Cache-Treffer gar keine Ladeanzeige', async () => {
    // Sie waere sofort wieder weg und wuerde nur aufblitzen.
    api.get.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });
    await raumOeffnen();
    await antippen('Plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));
    // Beim zweiten Mal haelt das Oeffnen selbst an: Stuende jetzt eine
    // Ladeanzeige, waere sie bis zum Ende des Oeffnens zu sehen.
    const oeffnen = aufgeschoben<boolean>();
    nativOeffnen.mockImplementationOnce(() => oeffnen.versprechen);
    zustand.ladeVerlauf = [];
    await antippen('Plan.pdf');
    await waitFor(() => expect(nativOeffnen).toHaveBeenCalledTimes(2));
    expect(within(zeile('Plan.pdf')).queryByText(/Wird geladen/)).toBeNull();
    expect(within(zeile('Plan.pdf')).queryByTestId('spinner')).toBeNull();
    expect(zustand.ladeVerlauf.filter(Boolean)).toEqual([]);
    await act(async () => { oeffnen.loesen(true); });
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('Senden-Icon: waagerecht statt schraeg', () => {
  it('nutzt send fuer den Chat-Knopf', () => {
    // paperPlane ist im SVG diagonal gezeichnet und sah im runden Knopf
    // schief aus (Simon, 11.09.2026).
    expect(ICON_SENDEN_GEFUELLT).toBe(send);
    expect(ICON_SENDEN_GEFUELLT).not.toBe(paperPlane);
  });

  it('laesst die Outline-Variante beim Papierflieger', () => {
    // ICON_SENDEN steht bei den Challenges fuer "eingereicht", nicht fuer
    // einen Senden-Knopf — die Form passt dort weiterhin.
    expect(ICON_SENDEN).toBe(paperPlaneOutline);
  });
});
