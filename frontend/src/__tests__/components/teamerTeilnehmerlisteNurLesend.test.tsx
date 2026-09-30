// Teamer-Teilnehmerliste: sichtbar, aber nur lesend (16.09.2026) --
// gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test,
// 30.09.2026 umgestellt).
//
// DER BEFUND (Simon am Gerät, wörtlich): "teamer sehen die tn liste nicht!"
//
// URSACHE: Die Teamer-Ansicht las ihren Termin ausschließlich aus der LISTE
// (GET /events). Die trägt nur Zahlen -- die Namen stehen allein in der
// Detailantwort GET /events/:id, und die hat diese Seite nie abgerufen.
//
// DIE ZWEITE HÄLFTE: Termine sind Leitungssache -- SEHEN ist nicht
// VERWALTEN. Die Liste darf keine Wisch-Aktionen, keine Action-Sheets und
// keine Verbuchungs-Knöpfe bekommen. Geprüft wird das hier an der
// gerenderten Liste: Jede Zeile wird angetippt, und es darf nichts
// passieren -- kein Menü, kein Aufruf an den Server.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnehmer, oeffneTermin, abschnitt, api, presentActionSheet, presentAlert, modale,
} from './gerueste/teamerTerminSeite';
import { teilnahmeDarstellung, listItemKlasse } from '../../utils/teilnahmeStatus';

beforeEach(zuruecksetzen);

const LISTE = [
  teilnehmer(1, 'Kim Konfi'),
  teilnehmer(2, 'Lea Warteliste', { status: 'waitlist' }),
  teilnehmer(3, 'Ole Abgemeldet', { status: 'opted_out' }),
  teilnehmer(4, 'Tom Teamer', { role_name: 'teamer' }),
];

const oeffneMitListe = async () => {
  zustand.events = [termin()];
  zustand.details.set(77, { participants: LISTE });
  await oeffneTermin();
  return abschnitt(/^Wer kommt/)!;
};

const zeileVonPerson = (name: string) => screen.getByText(name).closest('.app-list-item') as HTMLElement;

describe('Teamer-Teilnehmerliste', () => {
  it('holt die Teilnehmerliste aus der Detailantwort des Termins', async () => {
    await oeffneMitListe();
    expect(api.get).toHaveBeenCalledWith('/events/77');
  });

  it('zeigt die Namen der Teilnehmenden, getrennt nach Konfis und Team', async () => {
    const liste = await oeffneMitListe();
    expect(within(liste).getByText('Wer kommt (4)')).toBeInTheDocument();
    expect(within(liste).getByText('Konfis (3)')).toBeInTheDocument();
    expect(within(liste).getByText('Team (1)')).toBeInTheDocument();
    for (const p of LISTE) expect(within(liste).getByText(p.participant_name)).toBeInTheDocument();
  });

  it('ohne Detailantwort (nur die Liste) keine Namen und kein Abschnitt', async () => {
    zustand.events = [termin()];
    await oeffneTermin();
    expect(abschnitt(/^Wer kommt/)).toBeNull();
  });

  it('nimmt Text und Farbe aus der gemeinsamen Quelle (wie die Leitungsliste)', async () => {
    await oeffneMitListe();
    for (const p of LISTE) {
      const darstellung = teilnahmeDarstellung(p);
      const zeile = zeileVonPerson(p.participant_name);
      expect(zeile).toHaveClass(listItemKlasse(darstellung));
      expect(within(zeile).getByRole('img', { name: darstellung.statusText })).toBeInTheDocument();
    }
    // Stichwerte, damit die Quelle nicht mit sich selbst verglichen wird:
    expect(within(zeileVonPerson('Lea Warteliste')).getByRole('img').getAttribute('aria-label')).toBe('Warteliste');
    expect(within(zeileVonPerson('Ole Abgemeldet')).getByRole('img').getAttribute('aria-label')).toBe('Abgemeldet');
    expect(within(zeileVonPerson('Kim Konfi')).getByRole('img').getAttribute('aria-label')).toBe('Gebucht');
  });

  it('bietet keine Verbuchung und keine Wisch-Aktionen: keine Knöpfe, kein Wisch in der Liste', async () => {
    const liste = await oeffneMitListe();
    expect(within(liste).queryAllByRole('button')).toHaveLength(0);
    expect(within(liste).queryAllByTestId('wisch')).toHaveLength(0);
  });

  it('Antippen einer Zeile tut nichts: kein Menü, keine Rückfrage, kein Aufruf an den Server', async () => {
    await oeffneMitListe();
    const geoeffnetVorher = modale.geoeffnet.length;
    const getVorher = api.get.mock.calls.length;
    for (const p of LISTE) {
      await act(async () => { fireEvent.click(zeileVonPerson(p.participant_name)); });
    }
    expect(presentActionSheet).not.toHaveBeenCalled();
    expect(presentAlert).not.toHaveBeenCalled();
    expect(modale.geoeffnet.length).toBe(geoeffnetVorher);
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get.mock.calls.length).toBe(getVorher);
  });
});
