// „Aktivität prüfen" der Leitung im Browser, gerendert (Simon, 11.10.2026:
// „Web braucht eigene kompaktere Modale überall"). Unter Mitmachen >
// Aktivitäten öffnen „Prüfen" und „Ansehen" im breiten Layout den Dialog der
// Web-Fassung (WebAntragPruefenDialog) statt des Modals der App; schmal bleibt
// es beim Modal.
//
// Die Logik ist für App und Web dieselbe (admin/modals/useAntragPruefen.ts).
// Geprüft wird mit echter Seite und echter Logik -- nur Server, Kontext,
// Breite, Netz, Warteschlange, Messung und Ionic sind Attrappen (geruestWeb) --:
// benannte Angaben aus dem Antrag, Entscheiden schickt exakt diesen Rumpf an
// exakt diese Route, Ablehnen nur mit Grund (konkrete Meldung), danach lädt
// die Liste neu und die Zähler laufen an; ohne Netz geht die Entscheidung
// in die Warteschlange; Abbrechen schickt nichts. Solange entschieden oder das
// Foto gelöscht wird, lässt sich der Dialog nicht schließen (wie das X der
// App), damit ein Fehler des Servers nicht ins Leere geht.
import { h, api, setSuccess, setError, geoeffnet, zuruecksetzen, richteEin, oeffne, JETZT } from './geruestWeb';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import type { AntragZeile } from '../../../components/admin/web/termine/typen';

const m = vi.hoisted(() => ({ messen: vi.fn(), zaehler: 0 }));

vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  trackHandlung: (...a: unknown[]) => m.messen(...a),
}));
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => { m.zaehler += 1; return `kennung-${m.zaehler}`; } }));
// Das Foto lädt NachweisFoto selbst über das Medien-System (eigene Tests:
// nachweisfotoGemeinsam); hier zählt, dass der Dialog es mit der Route der Leitung zeigt.
vi.mock('../../../components/shared/NachweisFoto', () => ({
  default: ({ antragId, leitung }: { antragId: number; leitung?: boolean }) => (
    <img alt="Foto zur Aktivität" data-antrag={antragId} data-leitung={leitung ? 'ja' : 'nein'} />
  ),
}));

const antrag = (id: number, zusatz: Partial<AntragZeile>): AntragZeile => ({
  id, konfi_id: id + 10, konfi_name: 'Mia Muster', jahrgang_name: 'Jahrgang 2026', activity_id: 3,
  activity_name: 'Gemeindefest helfen', activity_type: 'gemeinde', activity_points: 2, activity_target_role: 'konfi',
  requested_date: '2026-09-27', status: 'pending', created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z',
  ...zusatz,
});

const OFFEN = antrag(71, { comment: 'Beim Aufbau geholfen', photo_filename: 'beleg.jpg' });
const VERBUCHT = antrag(72, {
  konfi_name: 'Ben Beispiel', activity_name: 'Sonntagsgottesdienst', activity_type: 'gottesdienst', activity_points: 1,
  status: 'approved', approved_by_name: 'Lea Leitung', admin_comment: 'Schön, dass du da warst', updated_at: '2026-09-21T10:00:00Z',
});
const OHNE_RECHT = antrag(73, { konfi_name: 'Zoe Probe', darf_entscheiden: false });
const TEAM = antrag(74, {
  konfi_name: 'Tim Teamer', jahrgang_name: undefined, activity_name: 'Freizeit begleitet', activity_type: undefined,
  activity_points: 0, activity_target_role: 'teamer',
});
const ANTRAEGE = [OFFEN, VERBUCHT, OHNE_RECHT, TEAM];

/** GET /admin/activities/requests/:id liefert den Antrag in der Form eines Listeneintrags. */
const serverAntraege = () => {
  h.api.get.mockImplementation(async (pfad: string) => {
    const treffer = /^\/admin\/activities\/requests\/(\d+)$/.exec(pfad);
    if (treffer) {
      const gefunden = ANTRAEGE.find((a) => a.id === Number(treffer[1]));
      if (gefunden) return { data: { ...gefunden } };
      throw Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: { error: 'Antrag nicht gefunden' } } });
    }
    return { data: [] };
  });
};

const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };

const oeffneListe = async (filter = '') => {
  richteEin({
    nutzer: 'leitung', pfad: '/admin/events', suche: `?segment=antraege${filter}`,
    daten: { 'admin:events:': [], 'admin:events-cancelled:': [], 'admin:jahrgaenge:': [], 'admin:requests:': ANTRAEGE },
  });
  return oeffne('leitung');
};

/** Öffnet den Antrag über seinen Knopf in der Liste und wartet, bis er geladen ist. */
const dialogVon = async (knopf: string, titel: 'Aktivität prüfen' | 'Aktivität ansehen') => {
  fireEvent.click(screen.getByRole('button', { name: knopf }));
  const dialog = screen.getByRole('dialog', { name: titel });
  await waitFor(() => expect(within(dialog).queryByText('Die Aktivität wird geladen.')).toBeNull());
  return dialog;
};
/** Die Angaben als [Bezeichnung, Wert]. */
const angaben = (dialog: HTMLElement) => [...within(dialog).getByLabelText('Angaben zur Aktivität').querySelectorAll('.web-angaben__zeile')]
  .map((z) => [z.querySelector('dt')!.textContent, z.querySelector('dd')!.textContent]);
const klick = async (dialog: HTMLElement, knopf: string) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: knopf })); });
  await warten();
};
const PUT_ROUTE = '/admin/activities/requests/71';
/** Ein Aufruf, der erst antwortet, wenn der Test es sagt. */
const haengend = () => {
  let ablehnen!: (grund: unknown) => void;
  const antwort = new Promise<never>((_, nein) => { ablehnen = nein; });
  return { antwort, ablehnen };
};
const SCHON_ENTSCHIEDEN = Object.assign(new Error('Request failed with status code 409'), {
  response: { status: 409, data: { error: 'Der Antrag wurde bereits bearbeitet' } },
});
/** X, Escape und der abgedunkelte Grund schließen den Dialog nicht. */
const bleibtOffen = (dialog: HTMLElement, titel: string) => {
  expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: titel })).toBe(dialog);
  fireEvent.mouseDown(dialog.parentElement!);
  expect(screen.getByRole('dialog', { name: titel })).toBe(dialog);
};

beforeEach(() => {
  zuruecksetzen();
  m.messen.mockReset();
  m.zaehler = 0;
  serverAntraege();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

describe('Aktivität prüfen im Browser: eigener Dialog', () => {
  it('„Prüfen" öffnet den Dialog mit den Angaben des Antrags, dem Foto und der Entscheidung -- kein Modal der App', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    expect(api.get).toHaveBeenCalledWith('/admin/activities/requests/71');
    expect(angaben(dialog)).toEqual([
      ['Von', 'Mia MusterJahrgang 2026'],
      ['Aktivität', 'Gemeindefest helfenGemeinde'],
      ['Punkte', '2 Punkte'],
      ['Teilnahmedatum', '27.09.2026'],
      ['Eingereicht', '02.10.2026, 11:00'],
      ['Kommentar', 'Beim Aufbau geholfen'],
    ]);
    const foto = within(dialog).getByRole('img', { name: 'Foto zur Aktivität' });
    expect(foto).toHaveAttribute('data-antrag', '71');
    expect(foto).toHaveAttribute('data-leitung', 'ja');
    expect(within(dialog).getByRole('button', { name: 'Foto löschen' })).toBeInTheDocument();
    const grund = within(dialog).getByRole('textbox', { name: 'Grund für die Ablehnung' });
    expect(grund).toHaveValue('');
    expect(grund).toHaveAttribute('placeholder', 'Bitte gib einen Grund für die Ablehnung an...');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['', 'Foto löschen', 'Abbrechen', 'Ablehnen', 'Genehmigen']);
    expect(geoeffnet('AdminActivityRequestModal')).toHaveLength(0);
  });

  it('„Genehmigen" schickt status approved an PUT /admin/activities/requests/71, misst erst danach und lädt Liste und Zähler neu', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    h.neuGeladen.length = 0;
    await klick(dialog, 'Genehmigen');
    expect(api.put.mock.calls).toEqual([[PUT_ROUTE, { status: 'approved', admin_comment: '' }]]);
    expect(m.messen).toHaveBeenCalledWith('antrag-entschieden', { entscheidung: 'angenommen', antrag_von: 'konfi' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.neuGeladen).toEqual(['admin:requests:1']);
    expect(h.triggerRefresh.mock.calls.map((a) => a[0])).toEqual(['requests', 'konfis']);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('„Ablehnen" ohne Grund sagt, was fehlt, und schickt nichts; mit Grund geht der Grund als admin_comment mit', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Ablehnen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte gib einen Grund für die Ablehnung an');
    expect(api.put).not.toHaveBeenCalled();
    // Nur Leerzeichen zählen nicht als Grund.
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Grund für die Ablehnung' }), { target: { value: '   ' } });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await klick(dialog, 'Ablehnen');
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Grund für die Ablehnung' }), { target: { value: 'Bitte ein Foto vom Fest nachreichen' } });
    await klick(dialog, 'Ablehnen');
    expect(api.put.mock.calls).toEqual([[PUT_ROUTE, { status: 'rejected', admin_comment: 'Bitte ein Foto vom Fest nachreichen' }]]);
    expect(m.messen).toHaveBeenCalledWith('antrag-entschieden', { entscheidung: 'abgelehnt', antrag_von: 'konfi' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lehnt der Server ab, steht sein Satz im Dialog; er bleibt offen, nichts wird gemessen oder neu geladen', async () => {
    h.api.put.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 403'), {
      response: { status: 403, data: { error: 'Über diesen Antrag entscheidet jemand anderes' } },
    }));
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Genehmigen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Über diesen Antrag entscheidet jemand anderes');
    expect(screen.getByRole('dialog', { name: 'Aktivität prüfen' })).toBe(dialog);
    expect(m.messen).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
  });

  it('während der Entscheidung bleibt der Dialog offen: X gesperrt, Escape und Klick daneben wirken nicht; ein 409 steht danach im Dialog', async () => {
    const put = haengend();
    h.api.put.mockImplementationOnce(() => put.antwort);
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Genehmigen');
    expect(api.put.mock.calls).toEqual([[PUT_ROUTE, { status: 'approved', admin_comment: '' }]]);
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    bleibtOffen(dialog, 'Aktivität prüfen');

    await act(async () => { put.ablehnen(SCHON_ENTSCHIEDEN); });
    await warten();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Der Antrag wurde bereits bearbeitet');
    expect(setError).not.toHaveBeenCalled();
    expect(m.messen).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
    // Fertig: Jetzt schließt er wieder.
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('während „Foto löschen" ebenso; scheitert es, steht die Meldung im Dialog', async () => {
    const loeschen = haengend();
    h.api.delete.mockImplementationOnce(() => loeschen.antwort);
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Foto löschen');
    expect(api.delete.mock.calls).toEqual([['/admin/activities/requests/71/photo']]);
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    bleibtOffen(dialog, 'Aktivität prüfen');

    await act(async () => { loeschen.ablehnen(new Error('Request failed with status code 500')); });
    await warten();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Löschen des Fotos');
    expect(within(dialog).getByRole('img', { name: 'Foto zur Aktivität' })).toBeInTheDocument();
    expect(setError).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
  });

  it('verschwindet der Dialog trotzdem während der Entscheidung (die Seite wird verlassen), kommt der Fehler des Servers als Meldung der App', async () => {
    const put = haengend();
    h.api.put.mockImplementationOnce(() => put.antwort);
    const seite = await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Genehmigen');
    seite.unmount();
    await act(async () => { put.ablehnen(SCHON_ENTSCHIEDEN); });
    await warten();
    expect(setError.mock.calls).toEqual([['Der Antrag wurde bereits bearbeitet']]);
    expect(m.messen).not.toHaveBeenCalled();
  });

  it('„Abbrechen" schließt und schickt nichts', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Grund für die Ablehnung' }), { target: { value: 'doch nicht' } });
    await klick(dialog, 'Abbrechen');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis im Dialog, die Entscheidung geht wie in der App in die Warteschlange, gemessen wird nicht', async () => {
    h.online = false;
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    expect(within(dialog).getByText('Ohne Verbindung wird die Entscheidung gespeichert, sobald du wieder online bist.')).toBeInTheDocument();
    await klick(dialog, 'Genehmigen');
    expect(api.put).not.toHaveBeenCalled();
    expect(h.enqueue.mock.calls).toEqual([[{
      method: 'PUT',
      url: PUT_ROUTE,
      body: { status: 'approved', admin_comment: '' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: 'kennung-1', label: 'Aktivität genehmigen' },
    }]]);
    expect(setSuccess).toHaveBeenCalledWith('Wird gespeichert sobald du wieder online bist');
    expect(m.messen).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Foto löschen" ruft DELETE auf das Foto; danach steht kein Foto mehr da', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Mia Muster prüfen', 'Aktivität prüfen');
    await klick(dialog, 'Foto löschen');
    expect(api.delete.mock.calls).toEqual([['/admin/activities/requests/71/photo']]);
    expect(setSuccess).toHaveBeenCalledWith('Foto erfolgreich gelöscht');
    expect(within(dialog).queryByRole('img', { name: 'Foto zur Aktivität' })).toBeNull();
  });

  it('erledigt: „Ansehen" zeigt den Bearbeitungsstand mit Kommentar und nur „Schließen"', async () => {
    await oeffneListe('&filter=verbucht');
    const dialog = await dialogVon('Aktivität von Ben Beispiel ansehen', 'Aktivität ansehen');
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Bearbeitungsstatus' })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Verbucht von Lea Leitung am 21.09.2026, 12:00');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Kommentar: Schön, dass du da warst');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['', 'Schließen']);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
  });

  it('ohne das Recht „Anträge entscheiden": ansehen, Hinweis statt Entscheidung', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Zoe Probe ansehen', 'Aktivität ansehen');
    expect(within(dialog).getByText('Über diesen Antrag entscheidet jemand anderes. Das Recht vergibt die Gemeindeleitung.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Genehmigen' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
  });

  it('Antrag des Teams: Art „Team", keine Punkte; die Messung nennt das Team', async () => {
    await oeffneListe();
    const dialog = await dialogVon('Aktivität von Tim Teamer prüfen', 'Aktivität prüfen');
    expect(angaben(dialog).map(([label]) => label)).toEqual(['Von', 'Aktivität', 'Teilnahmedatum', 'Eingereicht']);
    expect(angaben(dialog)[1]).toEqual(['Aktivität', 'Freizeit begleitetTeam']);
    await klick(dialog, 'Genehmigen');
    expect(api.put).toHaveBeenCalledWith('/admin/activities/requests/74', { status: 'approved', admin_comment: '' });
    expect(m.messen).toHaveBeenCalledWith('antrag-entschieden', { entscheidung: 'angenommen', antrag_von: 'teamer' });
  });

  it('lässt sich der Antrag nicht laden, steht der Satz des Servers da, und „Erneut versuchen" lädt neu', async () => {
    await oeffneListe();
    h.api.get.mockImplementationOnce(async () => {
      throw Object.assign(new Error('Request failed with status code 403'), { response: { status: 403, data: { error: 'Keine Berechtigung für diesen Jahrgang' } } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität von Mia Muster prüfen' }));
    const dialog = screen.getByRole('dialog', { name: 'Aktivität prüfen' });
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Keine Berechtigung für diesen Jahrgang'));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Die Aktivität konnte nicht geladen werden.');
    expect(within(dialog).queryByRole('button', { name: 'Genehmigen' })).toBeNull();
    await klick(dialog, 'Erneut versuchen');
    expect(api.get.mock.calls.filter(([p]) => p === '/admin/activities/requests/71')).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: 'Genehmigen' })).toBeInTheDocument();
  });
});

describe('Aktivität prüfen: schmal bleibt das Modal der App', () => {
  it('ein Antrag in der Liste der App öffnet „Aktivität prüfen" der App mit diesem Antrag, kein Dialog', async () => {
    h.breit = false;
    await oeffneListe();
    const zeile = screen.getAllByTestId('zeile').find((z) => z.textContent?.includes('Mia Muster'))!;
    fireEvent.click(zeile);
    const modal = geoeffnet('AdminActivityRequestModal');
    expect(modal).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith('/admin/activities/requests/71');
  });
});
