// „Aktivität melden" von Konfis und Team im Browser, gerendert (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Unter
// Mitmachen > Aktivitäten öffnet „Aktivität melden" im breiten Layout den
// Dialog der Web-Fassung (WebAktivitaetMeldenDialog) statt des Modals der App;
// schmal bleibt es beim Modal.
//
// Die Logik ist für App und Web dieselbe (shared/useAktivitaetMelden.ts).
// Geprüft wird mit echter Seite und echter Logik -- nur Server, Kontext,
// Breite, Netz, Warteschlange, Dateiauswahl, Verkleinerung, Messung und Ionic
// sind Attrappen (geruestWeb) --: benannte Felder mit Vorbelegung, Prüfung mit
// konkreter Meldung, die Rückfrage ohne Foto im Dialog, exakt dieser Rumpf an
// exakt diese Route (mit Foto erst der Upload), danach Erfolgsmeldung und
// Neuladen; ohne Netz die Warteschlange samt gesichertem Foto; Abbrechen
// schickt nichts. Solange gesendet wird, lässt sich der Dialog nicht
// schließen (wie das X der App), damit ein Fehler des Servers nicht ins Leere
// geht.
import { h, api, setSuccess, setError, geoeffnet, zuruecksetzen, richteEin, oeffne, JETZT } from './geruestWeb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  messen: vi.fn(),
  zaehler: 0,
  auswahl: vi.fn(),
  sichern: vi.fn(),
}));

vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  track: (...a: unknown[]) => m.messen(...a),
}));
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => { m.zaehler += 1; return `kennung-${m.zaehler}`; } }));
// Die Dateiauswahl der Hülle (die einzige Datei-Eingabe der App) und die
// Verkleinerung: eigene Tests (dateiAuswahl*, nachweisfotoGemeinsam).
vi.mock('../../../services/systemDialoge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/systemDialoge')>()),
  dateiAuswaehlen: (...a: unknown[]) => m.auswahl(...a),
}));
vi.mock('../../../services/mediaCompression', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mediaCompression')>()),
  fuerUploadVorbereiten: async (datei: File) => ({ file: datei, bildVorschau: null }),
}));
vi.mock('../../../services/warteschlangenDatei', () => ({
  warteschlangenDateiSichern: (...a: unknown[]) => m.sichern(...a),
}));

const KONFI_AKTIVITAETEN = [
  { id: 3, name: 'Gemeindefest helfen', points: 2, type: 'gemeinde', category_names: 'Feste' },
  { id: 1, name: 'Sonntagsgottesdienst', points: 1, type: 'gottesdienst' },
];
const TEAM_AKTIVITAETEN = [
  { id: 9, name: 'Konfi-Freizeit begleitet', points: 0, type: null, category_names: 'Freizeit' },
  { id: 10, name: 'Teamer-Schulung besucht', points: 0, type: null },
];

const foto = () => new File(['bilddaten'], 'beleg.jpg', { type: 'image/jpeg' });
const warten = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };

const oeffneKonfi = async () => {
  richteEin({
    nutzer: 'konfi', pfad: '/konfi/events', suche: '?segment=antraege',
    daten: { 'konfi:events:': [], 'konfi:requests:': [], 'konfi:activities:': KONFI_AKTIVITAETEN },
  });
  return oeffne('konfi');
};
const oeffneTeam = async () => {
  richteEin({
    nutzer: 'teamer', pfad: '/teamer/events', suche: '?segment=antraege',
    daten: { 'teamer:events:': [], 'teamer:requests:': [], 'teamer:activities:': TEAM_AKTIVITAETEN },
  });
  return oeffne('team');
};
const dialogOeffnen = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Neue Aktivität melden' }));
  return screen.getByRole('dialog', { name: 'Aktivität melden' });
};
/** Die Einträge der Auswahl: Titel und zweite Zeile. */
const eintraege = (dialog: HTMLElement) => within(dialog).getAllByRole('radio').map((r) => {
  const zeile = r.closest('label') as HTMLElement;
  return [zeile.querySelector('.web-wahl__titel')?.textContent, zeile.querySelector('.web-wahl__beschreibung')?.textContent ?? null];
});
const waehle = (dialog: HTMLElement, name: string) => fireEvent.click(within(dialog).getByRole('radio', { name: new RegExp(`^${name}`) }));
const tippen = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });
const klick = async (dialog: HTMLElement, knopf: string) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: knopf })); });
  await warten();
};
const fotoWaehlen = async (dialog: HTMLElement) => {
  m.auswahl.mockResolvedValueOnce([foto()]);
  await klick(dialog, 'Foto hinzufügen');
  await waitFor(() => expect(within(dialog).getByRole('img', { name: 'Gewähltes Foto' })).toBeInTheDocument());
};
const posts = () => api.post.mock.calls.map(([route, rumpf]) => [route, rumpf instanceof FormData ? 'FormData' : rumpf]);
/** Ein Aufruf, der erst antwortet, wenn der Test es sagt. */
const haengend = () => {
  let ablehnen!: (grund: unknown) => void;
  const antwort = new Promise<never>((_, nein) => { ablehnen = nein; });
  return { antwort, ablehnen };
};
const GIBT_ES_NICHT = Object.assign(new Error('Request failed with status code 400'), {
  response: { status: 400, data: { error: 'Diese Aktivität gibt es nicht mehr' } },
});
/** Konfi wählt Aktivität und Foto, „Melden" ist geklickt, der Upload hängt. */
const meldenMitHaengendemUpload = async () => {
  const upload = haengend();
  h.api.post.mockImplementation((route: string) => (route === '/konfi/upload-photo' ? upload.antwort : Promise.resolve({ data: { id: 501 } })));
  const seite = await oeffneKonfi();
  const dialog = dialogOeffnen();
  waehle(dialog, 'Gemeindefest helfen');
  await fotoWaehlen(dialog);
  // Wie mit der Maus: Der Knopf hat den Fokus, wenn er gesperrt wird.
  within(dialog).getByRole('button', { name: 'Melden' }).focus();
  await klick(dialog, 'Melden');
  expect(posts()).toEqual([['/konfi/upload-photo', 'FormData']]);
  return { seite, dialog, upload };
};

beforeEach(() => {
  zuruecksetzen();
  m.messen.mockReset();
  m.auswahl.mockReset();
  m.sichern.mockReset();
  m.sichern.mockImplementation(async (name: string) => `queue-uploads/${name}`);
  m.zaehler = 0;
  h.api.post.mockImplementation(async (route: string) => (route === '/konfi/upload-photo'
    ? { data: { filename: 'nachweis-123.jpg' } }
    : { data: { id: 501 } }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

describe('Aktivität melden (Konfi) im Browser: eigener Dialog', () => {
  it('benannte Felder mit Vorbelegung: Aktivität (mit Art, Punkten, Kategorie), Datum heute, Anmerkungen leer, Foto -- kein Modal der App', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    expect(dialog).toHaveAccessibleDescription('Die Leitung prüft deine Meldung; danach bekommst du die Punkte.');
    expect(h.abfragen).toContain('konfi:activities:1');
    expect(within(dialog).getByRole('group', { name: 'Aktivität' })).toBeInTheDocument();
    expect(eintraege(dialog)).toEqual([
      ['Gemeindefest helfen', 'Gemeinde · 2 Punkte · Feste'],
      ['Sonntagsgottesdienst', 'Gottesdienst · 1 Punkt'],
    ]);
    expect(within(dialog).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
    const datum = within(dialog).getByLabelText('Datum');
    expect(datum).toHaveAttribute('type', 'date');
    expect(datum).toHaveValue('2026-10-03');
    expect(datum).toHaveAttribute('max', '2026-10-03');
    expect(within(dialog).getByRole('textbox', { name: 'Anmerkungen' })).toHaveValue('');
    expect(within(dialog).getByRole('group', { name: 'Foto als Nachweis' })).toHaveTextContent('Foto hinzufügen');
    expect(within(dialog).getByRole('button', { name: 'Melden' })).toHaveAttribute('type', 'submit');
    expect(geoeffnet('KonfiActivityRequestModal')).toHaveLength(0);
  });

  it('ohne Aktivität sagt der Dialog, was fehlt, und schickt nichts', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    await klick(dialog, 'Melden');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte wähle eine Aktivität aus');
    expect(api.post).not.toHaveBeenCalled();
    // Wer wählt, nimmt die Meldung weg.
    waehle(dialog, 'Gemeindefest helfen');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('ohne Datum (das Feld lässt sich im Browser leeren) sagt der Dialog, was fehlt', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Gemeindefest helfen');
    tippen(within(dialog).getByLabelText('Datum'), '');
    await klick(dialog, 'Melden');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte wähle ein Datum aus');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('ohne Foto fragt der Dialog im Fenster nach; „Ohne Foto fortfahren" schickt exakt diesen Rumpf an POST /konfi/requests', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Gemeindefest helfen');
    tippen(within(dialog).getByLabelText('Datum'), '2026-10-01');
    tippen(within(dialog).getByRole('textbox', { name: 'Anmerkungen' }), '  Beim Aufbau geholfen  ');
    await klick(dialog, 'Melden');
    // Die Frage der App, im Dialog -- noch nichts gesendet.
    expect(within(dialog).getByRole('status')).toHaveTextContent('Kein Foto');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Normalerweise gehört ein Foto dazu, damit dein Team sieht, dass du dabei warst. Trotzdem abschicken?');
    expect(api.post).not.toHaveBeenCalled();
    expect(h.presentAlert).not.toHaveBeenCalled();

    h.neuGeladen.length = 0;
    await klick(dialog, 'Ohne Foto fortfahren');
    expect(posts()).toEqual([['/konfi/requests', {
      activity_id: 3,
      description: 'Beim Aufbau geholfen',
      requested_date: '2026-10-01',
      photo_filename: null,
      client_id: 'kennung-1',
    }]]);
    expect(m.messen).toHaveBeenCalledWith('aktivitaet-eingereicht', { mit_foto: false });
    expect(setSuccess).toHaveBeenCalledWith('Aktivität erfolgreich eingereicht!');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.neuGeladen).toEqual(['konfi:requests:7']);
  });

  it('mit Foto: Vorschau im Dialog, erst der Upload über POST /konfi/upload-photo, dann die Meldung mit seinem Dateinamen', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Sonntagsgottesdienst');
    await fotoWaehlen(dialog);
    expect(m.auswahl).toHaveBeenCalledWith({ accept: 'image/*' });
    expect(within(dialog).getByRole('img', { name: 'Gewähltes Foto' }).getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
    await klick(dialog, 'Melden');
    expect(posts()).toEqual([
      ['/konfi/upload-photo', 'FormData'],
      ['/konfi/requests', { activity_id: 1, description: '', requested_date: '2026-10-03', photo_filename: 'nachweis-123.jpg', client_id: 'kennung-1' }],
    ]);
    const hochgeladen = api.post.mock.calls[0][1] as FormData;
    expect((hochgeladen.get('photo') as File).name).toBe('beleg.jpg');
    expect(m.messen).toHaveBeenCalledWith('aktivitaet-eingereicht', { mit_foto: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Foto entfernen" nimmt das Foto wieder heraus; dann kommt die Rückfrage', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Sonntagsgottesdienst');
    await fotoWaehlen(dialog);
    await klick(dialog, 'Foto entfernen');
    expect(within(dialog).queryByRole('img', { name: 'Gewähltes Foto' })).toBeNull();
    await klick(dialog, 'Melden');
    expect(within(dialog).getByRole('button', { name: 'Ohne Foto fortfahren' })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis, die Meldung geht samt lokal gesichertem Foto in die Warteschlange', async () => {
    h.online = false;
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    expect(within(dialog).getByText('Ohne Verbindung wird die Aktivität gesendet, sobald du wieder online bist.')).toBeInTheDocument();
    waehle(dialog, 'Gemeindefest helfen');
    await fotoWaehlen(dialog);
    await klick(dialog, 'Melden');
    expect(api.post).not.toHaveBeenCalled();
    expect(m.sichern).toHaveBeenCalledWith('queue_kennung-1_photo.jpg', expect.stringMatching(/^data:image\/jpeg;base64,/));
    expect(h.enqueue.mock.calls).toEqual([[{
      method: 'POST',
      url: '/konfi/requests',
      body: {
        activity_id: 3,
        description: '',
        requested_date: '2026-10-03',
        client_id: 'kennung-1',
        _localPhotoPath: 'queue-uploads/queue_kennung-1_photo.jpg',
        _photoFileName: 'beleg.jpg',
      },
      maxRetries: 5,
      hasFileUpload: true,
      metadata: { type: 'request', clientId: 'kennung-1', label: 'Aktivität melden' },
    }]]);
    expect(setSuccess).toHaveBeenCalledWith('Aktivität wird gesendet sobald du wieder online bist');
    expect(m.messen).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lehnt der Server ab, steht sein Satz im Dialog; er bleibt offen und nichts lädt neu', async () => {
    h.api.post.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 400'), {
      response: { status: 400, data: { error: 'Diese Aktivität gibt es nicht mehr' } },
    }));
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Gemeindefest helfen');
    await klick(dialog, 'Melden');
    await klick(dialog, 'Ohne Foto fortfahren');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Diese Aktivität gibt es nicht mehr');
    expect(screen.getByRole('dialog', { name: 'Aktivität melden' })).toBe(dialog);
    expect(setSuccess).not.toHaveBeenCalled();
    expect(m.messen).not.toHaveBeenCalled();
  });

  it('während des Sendens bleibt der Dialog offen: X gesperrt, Escape und Klick daneben wirken nicht; lehnt der Server dann ab, steht sein Satz im Dialog', async () => {
    const { dialog, upload } = await meldenMitHaengendemUpload();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    // Der Fokus fällt nicht mit dem gesperrten Knopf aus dem Dialog.
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Aktivität melden' })).toBe(dialog);
    // Der abgedunkelte Grund um das Fenster.
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole('dialog', { name: 'Aktivität melden' })).toBe(dialog);

    await act(async () => { upload.ablehnen(GIBT_ES_NICHT); });
    await warten();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Diese Aktivität gibt es nicht mehr');
    expect(posts()).toEqual([['/konfi/upload-photo', 'FormData']]);
    expect(setSuccess).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(m.messen).not.toHaveBeenCalled();
    // Fertig gesendet: Jetzt schließt er wieder.
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('verschwindet der Dialog trotzdem während des Sendens (die Seite wird verlassen), kommt der Fehler des Servers als Meldung der App', async () => {
    const { seite, upload } = await meldenMitHaengendemUpload();
    seite.unmount();
    await act(async () => { upload.ablehnen(GIBT_ES_NICHT); });
    await warten();
    expect(setError.mock.calls).toEqual([['Diese Aktivität gibt es nicht mehr']]);
    expect(setSuccess).not.toHaveBeenCalled();
  });

  it('„Abbrechen" schließt und schickt nichts', async () => {
    await oeffneKonfi();
    const dialog = dialogOeffnen();
    waehle(dialog, 'Gemeindefest helfen');
    await klick(dialog, 'Abbrechen');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });
});

describe('Aktivität melden (Team) im Browser', () => {
  it('die Aktivitäten des Teams ohne Punkte, die Frage des Teams, POST /teamer/requests', async () => {
    await oeffneTeam();
    const dialog = dialogOeffnen();
    expect(dialog).toHaveAccessibleDescription('Die Leitung prüft deine Meldung.');
    expect(h.abfragen).toContain('teamer:activities:1');
    expect(eintraege(dialog)).toEqual([
      ['Konfi-Freizeit begleitet', 'Freizeit'],
      ['Teamer-Schulung besucht', null],
    ]);
    waehle(dialog, 'Konfi-Freizeit begleitet');
    await klick(dialog, 'Melden');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Aktivitäten benötigen normalerweise ein Foto als Nachweis. Möchtest du trotzdem fortfahren?');
    await klick(dialog, 'Ohne Foto fortfahren');
    expect(posts()).toEqual([['/teamer/requests', {
      activity_id: 9, description: '', requested_date: '2026-10-03', photo_filename: null, client_id: 'kennung-1',
    }]]);
    expect(setSuccess).toHaveBeenCalledWith('Aktivität erfolgreich eingereicht!');
    expect(h.neuGeladen).toContain('teamer:requests:9');
    expect(geoeffnet('TeamerActivityRequestModal')).toHaveLength(0);
  });
});

describe('Aktivität melden: schmal bleibt das Modal der App', () => {
  it('Konfi: der Knopf in der Kopfzeile öffnet das Modal der App, kein Dialog', async () => {
    h.breit = false;
    await oeffneKonfi();
    fireEvent.click(within(screen.getByTestId('kopfzeile')).getByRole('button', { name: 'Neue Aktivität melden' }));
    expect(geoeffnet('KonfiActivityRequestModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Team: ebenso das Modal des Teams', async () => {
    h.breit = false;
    await oeffneTeam();
    fireEvent.click(within(screen.getByTestId('kopfzeile')).getByRole('button', { name: 'Neue Aktivität melden' }));
    expect(geoeffnet('TeamerActivityRequestModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
