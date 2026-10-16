// Die Fenster der Seite eines Events bei der Leitung (EventDetailView),
// gerendert (Simon, 15.10.2026: im Browser ab 992 px jedes Formular als
// kompaktes Fenster der Web-Fassung, in den Apps und darunter das Modal wie
// bisher).
//
// Geprüft je Fenster:
//   - die Weiche: breit öffnet das Fenster der Web-Fassung (role="dialog" mit
//     seinem Namen) und kein Modal der App; schmal das Modal der App, wie bisher;
//   - derselbe Aufruf wie in der App: Was der Dialog speichert, geht mit
//     derselben Route und demselben Rumpf hinaus wie über das Modal der App
//     (dessen onSave hier direkt gerufen wird) -- dazu Prüfung und Fehler im
//     Fenster statt als Meldung oben.
// Die Logik je Fenster vergleichen webTeilnehmerHinzufuegen,
// webAnwesenheitAbsageFenster, webQrUndLegende und webMaterialAusEvent.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, api, setError, setSuccess, modale,
  letztesMenue, knopfIn,
} from '../gerueste/leitungTerminDetail';

vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

const geoeffnet = (name: string) => modale.geoeffnet.filter((m) => m.name === name);
const letztes = (name: string) => geoeffnet(name).at(-1)!;
const warte = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); }); };

const KIM = teilnahme(1, 'Kim Konfi', { jahrgang_name: 'Jahrgang 2026' });
const MIA = teilnahme(2, 'Mia Muster', { jahrgang_name: 'Jahrgang 2026', attendance_status: 'present', attendance_note: 'kam später' });
const TIM = teilnahme(5, 'Tim Teamer', { role_name: 'teamer', jahrgang_name: undefined });

beforeEach(() => {
  zuruecksetzen();
  breit.wert = true;
  zustand.detail = termin({
    name: 'Konfi-Freizeit', teamer_needed: true, registered_count: 2, participants: [KIM, MIA, TIM],
    jahrgaenge: [], unregistrations: [],
  });
  api.get.mockImplementation((pfad: string) => {
    if (/^\/events\/\d+$/.test(pfad)) return Promise.resolve({ data: zustand.detail });
    if (pfad === '/material/by-event/7') return Promise.resolve({ data: [{ id: 11, title: 'Packliste', file_count: 1 }] });
    if (pfad === '/material/11') return Promise.resolve({ data: { id: 11, title: 'Packliste', files: [], created_at: '2026-10-01T10:00:00Z' } });
    if (pfad === '/admin/konfis') return Promise.resolve({ data: [{ id: 31, name: 'Anna Neu', jahrgang_id: 1, jahrgang_name: 'Jahrgang 2026' }] });
    return Promise.resolve({ data: [] });
  });
});

/** Breit: das Menü „Weitere Aktionen" einer Person und darin ein Eintrag. */
const imMenue = async (name: string, eintrag: string) => {
  fireEvent.click(screen.getAllByRole('button', { name: `Weitere Aktionen für ${name}` })[0]);
  await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name })).getByRole('button', { name: eintrag })); });
};
/** Schmal: das Aktionsmenü der App an einer Person und darin ein Eintrag. */
const imAppMenue = async (name: string, eintrag: string) => {
  fireEvent.click(screen.getByText(name).closest('[data-testid="zeile"]') as HTMLElement);
  await act(async () => { await knopfIn(letztesMenue(), eintrag)!.handler!(); });
};

describe('Weiche: breit das Fenster der Web-Fassung, schmal das Modal der App', () => {
  it('QR-Code', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' })); });
    expect(screen.getByRole('dialog', { name: 'QR-Code zum Einchecken' })).toBeInTheDocument();
    expect(geoeffnet('QRDisplayModal')).toHaveLength(0);
    cleanup();
    breit.wert = false;
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    expect(geoeffnet('QRDisplayModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('Event absagen', async () => {
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    expect(screen.getByRole('dialog', { name: 'Event absagen' })).toBeInTheDocument();
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(0);
    cleanup();
    breit.wert = false;
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    expect(geoeffnet('TerminAbsagenModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('Abgemeldet eintragen und Notiz -- im App-Menü heißt es „Abgemeldet eintragen" wie im Browser', async () => {
    await oeffne();
    await imMenue('Kim Konfi', 'Abgemeldet eintragen');
    expect(screen.getByRole('dialog', { name: 'Abmeldung von Kim Konfi' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
    await imMenue('Mia Muster', 'Notiz bearbeiten');
    expect(screen.getByRole('dialog', { name: 'Notiz zu Mia Muster' })).toBeInTheDocument();
    expect(geoeffnet('AbmeldungNachtragenModal')).toHaveLength(0);
    expect(geoeffnet('AnwesenheitNotizModal')).toHaveLength(0);
    cleanup();
    breit.wert = false;
    await oeffne();
    await imAppMenue('Kim Konfi', 'Abgemeldet eintragen');
    expect(geoeffnet('AbmeldungNachtragenModal')).toHaveLength(1);
    await imAppMenue('Mia Muster', 'Notiz bearbeiten');
    expect(geoeffnet('AnwesenheitNotizModal')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('Konfi, Team, Leitung hinzufügen', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Konfi hinzufügen' })); });
    expect(screen.getByRole('dialog', { name: 'Konfi hinzufügen' })).toBeInTheDocument();
    expect(geoeffnet('ParticipantManagementModal')).toHaveLength(0);
    cleanup();
    breit.wert = false;
    await oeffne();
    for (const [name, rolle] of [['Konfi hinzufügen', 'konfi'], ['Team hinzufügen', 'teamer'], ['Leitung hinzufügen', 'leitung']] as const) {
      fireEvent.click(screen.getAllByRole('button', { name })[0]);
      expect(letztes('ParticipantManagementModal').props.filterRole).toBe(rolle);
    }
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('Material aus dem Event', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(within(screen.getByRole('region', { name: 'Material (1)' })).getByRole('button', { name: 'Packliste' })); });
    expect(screen.getByRole('dialog', { name: 'Material ansehen' })).toBeInTheDocument();
    expect(geoeffnet('TeamerMaterialDetailPage')).toHaveLength(0);
    cleanup();
    breit.wert = false;
    await oeffne();
    // Der Eintrag im Abschnitt Material (der Hinweis in den Eckdaten öffnet bei einem Material dasselbe).
    const eintrag = screen.getAllByText('Packliste').map((el) => el.closest('[role="button"]')).find(Boolean);
    fireEvent.click(eintrag as HTMLElement);
    expect(geoeffnet('TeamerMaterialDetailPage')).toHaveLength(1);
    expect(letztes('TeamerMaterialDetailPage').props.materialId).toBe(11);
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});

describe('Derselbe Aufruf wie in der App', () => {
  /** Was das Modal der App mit diesen Werten an den Server schickt (sein onSave, direkt gerufen). */
  const ueberDieApp = async (art: 'abmeldung' | 'notiz' | 'absage', name: string, werte: string[]) => {
    cleanup();
    breit.wert = false;
    zuruecksetzenOhneDaten();
    await oeffne();
    if (art === 'absage') fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    else await imAppMenue(name, art === 'abmeldung' ? 'Abgemeldet eintragen' : 'Notiz bearbeiten');
    const modal = letztes(art === 'abmeldung' ? 'AbmeldungNachtragenModal' : art === 'notiz' ? 'AnwesenheitNotizModal' : 'TerminAbsagenModal');
    await act(async () => { await (modal.props.onSave as (...a: string[]) => Promise<void>)(...werte); });
    return api.put.mock.calls;
  };
  const zuruecksetzenOhneDaten = () => { api.put.mockClear(); setSuccess.mockClear(); setError.mockClear(); };

  it('Abmeldung: PUT …/attendance mit Status, Grund und Notiz -- wie das Modal der App', async () => {
    await oeffne();
    await imMenue('Kim Konfi', 'Abgemeldet eintragen');
    const d = screen.getByRole('dialog', { name: 'Abmeldung von Kim Konfi' });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Grund' }), { target: { value: ' krank ' } });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Notiz (optional)' }), { target: { value: 'Attest liegt vor' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Abmeldung speichern' })); });
    await warte();
    expect(screen.queryByRole('dialog')).toBe(null);
    const web = [...api.put.mock.calls];
    expect(web).toEqual([['/events/7/participants/1/attendance', { attendance_status: 'excused', excuse_reason: 'krank', attendance_note: 'Attest liegt vor' }]]);
    expect(await ueberDieApp('abmeldung', 'Kim Konfi', ['krank', 'Attest liegt vor'])).toEqual(web);
  });

  it('Notiz: PUT …/attendance mit dem bisherigen Status und der neuen Notiz -- wie das Modal der App', async () => {
    await oeffne();
    await imMenue('Mia Muster', 'Notiz bearbeiten');
    const d = screen.getByRole('dialog', { name: 'Notiz zu Mia Muster' });
    expect(within(d).getByRole('textbox', { name: 'Notiz' })).toHaveValue('kam später');
    fireEvent.change(within(d).getByRole('textbox', { name: 'Notiz' }), { target: { value: 'kam 20 Minuten später' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Notiz speichern' })); });
    await warte();
    const web = [...api.put.mock.calls];
    expect(web).toEqual([['/events/7/participants/2/attendance', { attendance_status: 'present', attendance_note: 'kam 20 Minuten später' }]]);
    expect(await ueberDieApp('notiz', 'Mia Muster', ['kam 20 Minuten später'])).toEqual(web);
  });

  it('Abmeldung scheitert: die Meldung steht im Fenster, es bleibt offen, die Zeile wie vorher -- keine Meldung oben', async () => {
    api.put.mockRejectedValue(new Error('Netz weg'));
    await oeffne();
    await imMenue('Kim Konfi', 'Abgemeldet eintragen');
    const d = screen.getByRole('dialog', { name: 'Abmeldung von Kim Konfi' });
    fireEvent.change(within(d).getByRole('textbox', { name: 'Grund' }), { target: { value: 'krank' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Abmeldung speichern' })); });
    await warte();
    expect(within(screen.getByRole('dialog', { name: 'Abmeldung von Kim Konfi' })).getByRole('alert'))
      .toHaveTextContent('Fehler beim Aktualisieren der Anwesenheit');
    // Oben steht keine Meldung (das Leeren beim Öffnen der Seite zählt nicht).
    expect(setError.mock.calls.filter(([text]) => text)).toEqual([]);
    expect(screen.queryByText(/Abgemeldet: krank/)).toBe(null);
  });

  it('Absage: PUT /events/7/cancel mit Grund und dem Satz der Mitteilung, danach zurück zur Liste -- wie das Modal der App', async () => {
    const { onBack } = await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    const d = screen.getByRole('dialog', { name: 'Event absagen' });
    // Angemeldet: Konfis mit Status confirmed (Kim und Mia) -- dieselbe Zahl wie im Modal der App.
    expect(d).toHaveAccessibleDescription(/^„Konfi-Freizeit“ · .+ · 2 Konfis angemeldet$/);
    fireEvent.change(within(d).getByRole('textbox', { name: 'Grund (optional)' }), { target: { value: 'Heizung defekt' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Event absagen' })); });
    await warte();
    const web = [...api.put.mock.calls];
    expect(web).toEqual([['/events/7/cancel', { notification_message: 'Das Event wurde leider abgesagt.', cancelled_reason: 'Heizung defekt' }]]);
    expect(setSuccess).toHaveBeenCalledWith('Event wurde abgesagt');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(await ueberDieApp('absage', '', ['Heizung defekt'])).toEqual(web);
  });

  it('Absage abgelehnt: die Begründung des Servers im Fenster, es bleibt offen, kein Rückweg', async () => {
    api.put.mockRejectedValue({ response: { status: 400, data: { error: 'Event ist bereits abgesagt' } } });
    const { onBack } = await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event absagen' }));
    const d = screen.getByRole('dialog', { name: 'Event absagen' });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Event absagen' })); });
    await warte();
    expect(within(screen.getByRole('dialog', { name: 'Event absagen' })).getByRole('alert')).toHaveTextContent('Event ist bereits abgesagt');
    expect(onBack).not.toHaveBeenCalled();
    // Oben steht keine Meldung (das Leeren beim Öffnen der Seite zählt nicht).
    expect(setError.mock.calls.filter(([text]) => text)).toEqual([]);
  });

  it('Konfi hinzufügen: POST /events/7/participants, danach schließt das Fenster und das Event lädt neu', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Konfi hinzufügen' })); });
    await warte();
    const d = screen.getByRole('dialog', { name: 'Konfi hinzufügen' });
    await waitFor(() => expect(within(d).getByRole('checkbox', { name: /^Anna Neu/ })).toBeInTheDocument());
    fireEvent.click(within(d).getByRole('checkbox', { name: /^Anna Neu/ }));
    const vorher = api.get.mock.calls.filter(([p]) => p === '/events/7').length;
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: '1 hinzufügen' })); });
    await warte();
    expect(api.post.mock.calls).toEqual([['/events/7/participants', { user_id: 31, status: 'confirmed', ueberbuchen: false }]]);
    expect(screen.queryByRole('dialog')).toBe(null);
    // Das Fenster lädt einmal nach dem Eintragen, die Seite einmal danach.
    expect(api.get.mock.calls.filter(([p]) => p === '/events/7').length).toBe(vorher + 2);
  });
});
