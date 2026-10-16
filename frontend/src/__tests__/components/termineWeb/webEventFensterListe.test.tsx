// Die Fenster der Event-Liste der Leitung (AdminEventsPage) und der
// Event-Seite des Teams (TeamerEventsPage), gerendert (Simon, 15.10.2026: im
// Browser ab 992 px jedes Formular als kompaktes Fenster, in den Apps und
// darunter das Modal wie bisher).
//
//   - Absagen und den Absagegrund bearbeiten aus Zeile und Karte: breit der
//     Dialog, schmal das Modal der App -- derselbe Aufruf (PUT …/cancel bzw.
//     PUT …/absagegrund), dieselbe Meldung, dieselben Listen neu geladen.
//   - „Event einer Serie löschen": breit ein kleines Fenster, schmal das
//     Aktionsmenü der App -- dieselben Wege mit denselben Namen, danach in
//     beiden dieselbe Rückfrage der Seite.
//   - Team: QR-Code und Material schmal als Modal der App (breit als Fenster:
//     webTeamTerminDetail.test.tsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import {
  h, api, setSuccess, setError, presentActionSheet, geoeffnet, letzteRueckfrage, knopfIn,
  zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

const KONFI_TAG = termin(202, 'Konfi-Tag', { event_date: inTagen(14), registered_count: 12, max_participants: 30 });
const FAHRRADTOUR = termin(206, 'Fahrradtour', {
  event_date: inTagen(10), registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturmwarnung', registered_count: 9,
});
// Eine Serie mit drei Abenden; der mittlere wird gelöscht.
const SERIE = [1, 2, 3].map((n) => termin(300 + n, `Konfi-Abend ${n}`, { event_date: inTagen(7 * n), is_series: true, series_id: 9 }));

beforeEach(() => {
  zuruecksetzen();
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

const oeffneListe = (events = [KONFI_TAG, ...SERIE]) => {
  richteEin({ nutzer: 'leitung', pfad: '/admin/events', daten: { 'admin:events:': events, 'admin:events-cancelled:': [FAHRRADTOUR], 'admin:jahrgaenge:': [], 'admin:requests:': [] } });
  return oeffne('leitung');
};
const zeileVon = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement;
/** Schmal: die Wischaktion einer Zeile der App. */
const wisch = (name: string, aktion: string) => {
  const zeile = screen.getAllByTestId('termin').find((t) => t.textContent?.includes(name)) as HTMLElement;
  fireEvent.click(within(zeile).getByRole('button', { name: aktion }));
};

describe('Absagen aus der Liste: derselbe Aufruf in Browser und App', () => {
  it('breit: der Dialog sagt ab -- PUT /events/202/cancel, Meldung, beide Listen neu; schmal schickt das Modal dasselbe', async () => {
    await oeffneListe();
    fireEvent.click(within(zeileVon('Konfi-Tag')).getByRole('button', { name: 'Event absagen' }));
    const d = screen.getByRole('dialog', { name: 'Event absagen' });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Grund (optional)' }), { target: { value: 'Heizung defekt' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Event absagen' })); });
    const web = [...api.put.mock.calls];
    expect(web).toEqual([['/events/202/cancel', { notification_message: 'Das Event wurde leider abgesagt.', cancelled_reason: 'Heizung defekt' }]]);
    expect(setSuccess).toHaveBeenCalledWith('Event "Konfi-Tag" wurde abgesagt');
    expect(h.neuGeladen).toEqual(['admin:events:1', 'admin:events-cancelled:1']);
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(0);

    cleanup();
    api.put.mockClear();
    h.breit = false;
    await oeffneListe();
    wisch('Konfi-Tag', 'Event absagen');
    const modal = geoeffnet('TerminAbsagenModal').at(-1)!;
    expect(modal.props.modus).toBe('absagen');
    expect(modal.props.konfiAnzahl).toBe(12);
    await act(async () => { await (modal.props.onSave as (g: string) => Promise<void>)('Heizung defekt'); });
    expect(api.put.mock.calls).toEqual(web);
  });

  it('am abgesagten Event: den Grund ändern -- PUT /events/206/absagegrund, wie das Modal der App', async () => {
    await oeffneListe();
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    fireEvent.click(within(zeileVon('Fahrradtour')).getByRole('button', { name: 'Absagegrund bearbeiten' }));
    const d = screen.getByRole('dialog', { name: 'Absagegrund bearbeiten' });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Grund' }), { target: { value: 'Unwetter' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Absagegrund speichern' })); });
    expect(api.put.mock.calls).toEqual([['/events/206/absagegrund', { cancelled_reason: 'Unwetter' }]]);
    expect(setSuccess).toHaveBeenCalledWith('Absagegrund gespeichert');
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('lehnt der Server ab, steht seine Begründung im Dialog; nichts oben, die Listen bleiben', async () => {
    api.put.mockRejectedValue({ response: { status: 403, data: { error: 'Nur die Leitung darf absagen' } } });
    await oeffneListe();
    fireEvent.click(within(zeileVon('Konfi-Tag')).getByRole('button', { name: 'Event absagen' }));
    const d = screen.getByRole('dialog', { name: 'Event absagen' });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Event absagen' })); });
    expect(within(screen.getByRole('dialog', { name: 'Event absagen' })).getByRole('alert')).toHaveTextContent('Nur die Leitung darf absagen');
    expect(setError).not.toHaveBeenCalled();
    expect(h.neuGeladen).toEqual([]);
  });
});

describe('Event einer Serie löschen: dieselben Wege, dieselbe Rückfrage danach', () => {
  /** Die Wege, wie die App sie im Aktionsmenü zeigt. */
  const WEGE = ['Nur dieses Event löschen', 'Dieses + alle folgenden löschen (2 Events)', 'Ganze Serie löschen (3 Events)'];

  it('breit: ein kleines Fenster mit denselben Wegen; „Dieses + alle folgenden" fragt wie die App nach und löscht erst dann', async () => {
    await oeffneListe();
    fireEvent.click(within(zeileVon('Konfi-Abend 2')).getByRole('button', { name: 'Event löschen' }));
    const d = screen.getByRole('dialog', { name: 'Event einer Serie löschen' });
    expect(d).toHaveAccessibleDescription('"Konfi-Abend 2" ist Teil einer Serie mit 3 Events.');
    expect(within(d).getAllByRole('button').map((b) => b.textContent!.trim()).filter((t) => WEGE.includes(t))).toEqual(WEGE);
    expect(presentActionSheet).not.toHaveBeenCalled();

    fireEvent.click(within(d).getByRole('button', { name: WEGE[1] }));
    expect(screen.queryByRole('dialog')).toBe(null);
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Serie löschen');
    expect(frage.message).toBe('Wirklich dieses und alle folgenden löschen (2 Events)?');
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Löschen')!.handler!(); });
    expect(api.delete.mock.calls.map(([p]) => p).sort()).toEqual(['/events/302', '/events/303']);
  });

  it('schmal: das Aktionsmenü der App mit denselben Wegen und derselben Rückfrage', async () => {
    h.breit = false;
    await oeffneListe();
    wisch('Konfi-Abend 2', 'Event löschen');
    const menue = presentActionSheet.mock.calls.at(-1)![0] as { header: string; subHeader: string; buttons: Array<{ text: string; handler?: () => void }> };
    expect(menue.header).toBe('Event einer Serie löschen');
    expect(menue.subHeader).toBe('"Konfi-Abend 2" ist Teil einer Serie mit 3 Events.');
    expect(menue.buttons.map((b) => b.text)).toEqual([...WEGE, 'Abbrechen']);
    expect(screen.queryByRole('dialog')).toBe(null);
    act(() => { menue.buttons.find((b) => b.text === WEGE[1])!.handler!(); });
    expect(letzteRueckfrage().message).toBe('Wirklich dieses und alle folgenden löschen (2 Events)?');
  });

  it('„Nur dieses" fragt wie beim einzelnen Event; Escape schließt das Fenster ohne Rückfrage', async () => {
    await oeffneListe();
    fireEvent.click(within(zeileVon('Konfi-Abend 3')).getByRole('button', { name: 'Event löschen' }));
    // Nach dem letzten Abend kommt keiner mehr: nur zwei Wege.
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /alle folgenden/ })).toBe(null);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(h.presentAlert).not.toHaveBeenCalled();

    fireEvent.click(within(zeileVon('Konfi-Abend 1')).getByRole('button', { name: 'Event löschen' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: WEGE[0] }));
    expect(letzteRueckfrage().header).toBe('Event löschen');
    expect(letzteRueckfrage().message).toBe('Event "Konfi-Abend 1" wirklich löschen?');
  });
});

describe('Team: QR-Code und Material im schmalen Fenster weiter als Modal der App', () => {
  const FREIZEIT = termin(402, 'Konfi-Freizeit', {
    event_date: inTagen(14), teamer_needed: true, teamer_registration_status: 'open', is_registered: true, booking_status: 'confirmed',
  });

  it('QR-Code und Material öffnen die Modale der App, kein Fenster', async () => {
    h.breit = false;
    h.api.get.mockImplementation((pfad: string) => {
      if (pfad === '/events/402') return Promise.resolve({ data: { ...FREIZEIT, participants: [] } });
      if (pfad === '/material/by-event/402') return Promise.resolve({ data: [{ id: 11, title: 'Packliste', file_count: 1 }] });
      return Promise.resolve({ data: [] });
    });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=402', daten: { 'teamer:events:': [FREIZEIT], 'teamer:requests:': [] } });
    await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code zum Einchecken anzeigen' }));
    expect(geoeffnet('QRDisplayModal')).toHaveLength(1);
    const eintrag = screen.getAllByText('Packliste').map((el) => el.closest('[role="button"]')).find(Boolean);
    fireEvent.click(eintrag as HTMLElement);
    expect(geoeffnet('TeamerMaterialDetailPage')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});
