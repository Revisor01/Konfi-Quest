// Offenes direkt aus der Detailansicht einer Person bestaetigen (09.10.2026).
//
// Simon: "In ein Konfi reingehen, seinen Status sehen und Offenes von da aus
// direkt bestaetigen -- zwei Wege, gleiches Ziel. Gilt fuer Events und
// Aktivitaeten." Kein eigener Bereich: Offene Antraege stehen oben in den
// Aktivitaeten, zu verbuchende und anstehende Termine oben in den Events.
//
// Geprueft wird Verhalten in der App-Ansicht: was oben steht, welches Fenster
// bzw. welche Route ein Tipp ausloest, und dass Knoepfe nur erscheinen, wo der
// Server sie annimmt.
import { zustand, api, setError, modale, zuletztGeoeffnet, konfi, zuruecksetzen, oeffne, knopf, KONFI_ID } from './gerueste/leitungKonfiDetail';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, act, cleanup } from '@testing-library/react';

const ANTRAG = {
  id: 71, user_id: KONFI_ID, status: 'pending', activity_name: 'Gemeindebrief austragen',
  activity_points: 2, requested_date: '2026-10-02', photo_filename: 'foto.jpg',
};
const VERBUCHT = { id: 1, name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', date: '2026-09-30', completed_date: '2026-09-30', admin_name: 'Sam' };
const OFFEN = { booking_id: 501, event_id: 41, event_name: 'Konfisamstag', event_date: '2026-10-03T09:00:00Z', booking_status: 'confirmed', art: 'verbuchen', darf_verbuchen: true };
const BALD = { booking_id: 502, event_id: 42, event_name: 'Laternenumzug', event_date: '2026-11-11T17:00:00Z', booking_status: 'waitlist', art: 'anstehend', darf_verbuchen: true };

const titelInReihe = () => [...document.querySelectorAll('.app-list-item__title')].map((t) => t.textContent?.trim() ?? '');

beforeEach(() => {
  cleanup();
  zuruecksetzen();
});

describe('Aktivitaeten: offene Antraege oben, Antippen entscheidet', () => {
  it('der offene Antrag steht VOR dem Verbuchten, der Zaehler zaehlt nur Verbuchtes', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ activities: [VERBUCHT] }));
    zustand.antworten.set('/admin/activities/requests', [ANTRAG]);
    await oeffne();
    const reihe = titelInReihe();
    expect(reihe.indexOf('Gemeindebrief austragen (gemeldet)')).toBeLessThan(reihe.indexOf('Gottesdienstbesuch'));
    expect(reihe.indexOf('Gemeindebrief austragen (gemeldet)')).toBeGreaterThanOrEqual(0);
    expect(screen.getByText(/^Aktivitäten \(1\)/)).toBeInTheDocument();
  });

  it('mit Recht: Antippen oeffnet "Aktivität prüfen" der Antragsliste mit diesem Antrag', async () => {
    zustand.antworten.set('/admin/activities/requests', [ANTRAG]);
    await oeffne();
    expect(screen.getByText('Antippen zum Prüfen')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Gemeindebrief austragen (gemeldet)'));
    const pruefen = zuletztGeoeffnet('ActivityRequestModal');
    expect(pruefen).toBeDefined();
    expect(pruefen!.props.requestId).toBe(71);
    expect(zuletztGeoeffnet('NachweisFotoAnsicht')).toBeUndefined();
  });

  it('nach der Entscheidung laedt die Ansicht neu', async () => {
    zustand.antworten.set('/admin/activities/requests', [ANTRAG]);
    await oeffne();
    fireEvent.click(screen.getByText('Gemeindebrief austragen (gemeldet)'));
    const vorher = api.get.mock.calls.filter(([p]) => p === `/admin/konfis/${KONFI_ID}`).length;
    await act(async () => { (zuletztGeoeffnet('ActivityRequestModal')!.props.onSuccess as () => void)(); });
    const nachher = api.get.mock.calls.filter(([p]) => p === `/admin/konfis/${KONFI_ID}`).length;
    expect(nachher).toBe(vorher + 1);
  });

  it('ohne Recht ("darf_entscheiden": false): kein Pruefen, Antippen zeigt nur das Foto', async () => {
    zustand.antworten.set('/admin/activities/requests', [{ ...ANTRAG, darf_entscheiden: false }]);
    await oeffne();
    expect(screen.getByText('Wartend auf Genehmigung')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Gemeindebrief austragen (gemeldet)'));
    expect(zuletztGeoeffnet('ActivityRequestModal')).toBeUndefined();
    expect(zuletztGeoeffnet('NachweisFotoAnsicht')).toBeDefined();
  });
});

describe('Events: offene Anwesenheit und anstehende Termine oben', () => {
  it('zu verbuchen zuerst, dann anstehend, dann die Event-Punkte; der Zaehler bleibt bei den Punkten', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [OFFEN, BALD] }));
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}/event-points`, [
      { id: 1, event_id: 9, points: 2, point_type: 'gemeinde', event_name: 'Konfi-Wochenende', event_date: '2026-09-04', admin_name: 'Alex' },
    ]);
    await oeffne();
    const reihe = titelInReihe();
    expect(reihe.indexOf('Konfisamstag')).toBeLessThan(reihe.indexOf('Laternenumzug'));
    expect(reihe.indexOf('Laternenumzug')).toBeLessThan(reihe.indexOf('Konfi-Wochenende'));
    expect(screen.getByText('Events (2)')).toBeInTheDocument();
    const offen = document.querySelector('[data-termin-art="verbuchen"]')!;
    const bald = document.querySelector('[data-termin-art="anstehend"]')!;
    expect(offen.className).toContain('app-list-item--warning');
    expect(bald.className).toContain('app-list-item--info');
    expect(screen.getByText('Anwesenheit ausstehend')).toBeInTheDocument();
    expect(screen.getByText('Warteliste')).toBeInTheDocument();
    // Anstehende Termine haben keinen Knopf.
    expect(knopf(/Laternenumzug/)).toBeNull();
  });

  it('"Anwesend" ruft dieselbe Route wie der Termin und laedt neu', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [OFFEN] }));
    await oeffne();
    const vorher = api.get.mock.calls.filter(([p]) => p === `/admin/konfis/${KONFI_ID}`).length;
    await act(async () => { fireEvent.click(knopf('Konfisamstag: anwesend')!); });
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/events/41/participants/501/attendance', { attendance_status: 'present' });
    const nachher = api.get.mock.calls.filter(([p]) => p === `/admin/konfis/${KONFI_ID}`).length;
    expect(nachher).toBe(vorher + 1);
  });

  it('"Nicht anwesend" setzt absent', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [OFFEN] }));
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfisamstag: nicht anwesend')!); });
    expect(api.put).toHaveBeenCalledWith('/events/41/participants/501/attendance', { attendance_status: 'absent' });
  });

  it('ohne Recht am Termin (darf_verbuchen false): Stand ja, Knoepfe nein', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [{ ...OFFEN, darf_verbuchen: false }] }));
    await oeffne();
    expect(screen.getByText('Anwesenheit ausstehend')).toBeInTheDocument();
    expect(knopf(/Konfisamstag/)).toBeNull();
  });

  it('als Teamer:in angemeldet: keine Knoepfe, auch wenn der Termin es hergaebe', async () => {
    zustand.rolle = 'teamer';
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [OFFEN] }));
    await oeffne();
    expect(screen.getByText('Anwesenheit ausstehend')).toBeInTheDocument();
    expect(knopf(/Konfisamstag/)).toBeNull();
  });

  it('ein Fehler der Route wird gemeldet', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ termine: [OFFEN] }));
    api.put.mockRejectedValueOnce(Object.assign(new Error('403'), { response: { status: 403, data: { error: 'Du darfst an diesem Event nicht verbuchen.' } } }));
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Konfisamstag: anwesend')!); });
    expect(setError).toHaveBeenCalledWith('Du darfst an diesem Event nicht verbuchen.');
  });

  it('Teamer:in als Person: oben Stehendes steht unten nicht noch einmal', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({
      role_name: 'teamer', name: 'Tom', display_name: 'Tom',
      termine: [{ ...OFFEN, event_id: 305, event_name: 'Teamer-Treffen' }],
      teamerEvents: [
        { id: 301, name: 'Konfi-Wochenende', event_date: '2026-09-13', location: 'X', teamer_only: false, teamer_needed: true, booking_status: 'confirmed', booking_date: '2026-08-01', attendance_status: 'present' },
        { id: 305, name: 'Teamer-Treffen', event_date: '2026-10-03', location: 'X', teamer_only: true, teamer_needed: false, booking_status: 'confirmed', booking_date: '2026-10-01', attendance_status: null },
      ],
    }));
    await oeffne();
    expect(titelInReihe().filter((t) => t === 'Teamer-Treffen')).toHaveLength(1);
    expect(titelInReihe().indexOf('Teamer-Treffen')).toBeLessThan(titelInReihe().indexOf('Konfi-Wochenende'));
    // Der Zaehler zaehlt wie bisher alle Events.
    expect(screen.getByText('Events (2)')).toBeInTheDocument();
    await act(async () => { fireEvent.click(knopf('Teamer-Treffen: anwesend')!); });
    expect(api.put).toHaveBeenCalledWith('/events/305/participants/501/attendance', { attendance_status: 'present' });
  });

  it('aeltere Server ohne Feld termine: die Liste bleibt wie bisher', async () => {
    await oeffne();
    expect(document.querySelector('[data-termin-art]')).toBeNull();
    expect(screen.getByText('Keine Event-Punkte')).toBeInTheDocument();
    expect(modale.geoeffnet).toHaveLength(0);
  });
});
