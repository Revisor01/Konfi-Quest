// Das Team sieht Abmeldegrund und Notiz (Simon, 18.09.2026) -- gerendert
// (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026
// umgestellt).
//
//   "Die Teamer sollen Abmeldung Grund und Notizen sehen. Wenn ich schreibe
//    geht 14 Uhr statt 15 Uhr müssen das alle sehen."
//
// DIE LAGE VORHER: In der Teilnehmerliste des Teams standen nur Name, Status
// und Jahrgang. Wer eine Notiz schrieb ("geht um 14 Uhr"), erreichte damit
// nur die Leitung -- ausgerechnet die Leute, die am Termin vor Ort sind,
// erfuhren nichts davon.
//
// Verbucht wird weiterhin von der Leitung (requireAdmin). Es geht allein ums
// LESEN: Die Angaben liegen in der Antwort von GET /events/:id.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, teilnehmer, oeffneTermin, abschnitt } from './gerueste/teamerTerminSeite';
import { urheberZeile, notizUrheberZeile, checkinZeile } from '../../utils/anwesenheitUrheber';
import type { Participant } from '../../types/event';

beforeEach(zuruecksetzen);

const ABGEMELDET = teilnehmer(1, 'Ole Abgemeldet', {
  status: 'opted_out', excuse_reason: 'Krank',
  attendance_set_by_name: 'Pastor Luthe', attendance_set_at: '2026-09-18T08:00:00Z',
} as Partial<Participant>);
const MIT_NOTIZ = teilnehmer(2, 'Kim Konfi', {
  attendance_note: 'geht 14 Uhr statt 15 Uhr',
  note_set_by_name: 'Pastor Luthe', note_set_at: '2026-09-18T09:00:00Z',
} as Partial<Participant>);
const PER_QR = teilnehmer(3, 'Mia Eingecheckt', {
  attendance_status: 'present', checkin_quelle: 'qr', checked_in_at: '2026-09-18T10:00:00Z',
} as Partial<Participant>);

const zeileVon = (name: string) => screen.getByText(name).closest('.app-list-item') as HTMLElement;

const oeffne = async () => {
  zustand.events = [termin()];
  zustand.details.set(77, { participants: [ABGEMELDET, MIT_NOTIZ, PER_QR] });
  await oeffneTermin();
};

describe('Teamer-Teilnehmerliste zeigt Grund und Notiz', () => {
  it('der Abmeldegrund steht in der Liste', async () => {
    await oeffne();
    expect(within(zeileVon('Ole Abgemeldet')).getByText('Abgemeldet:').parentElement!.textContent).toBe('Abgemeldet: Krank');
  });

  it('die Notiz steht in der Liste', async () => {
    await oeffne();
    expect(within(zeileVon('Kim Konfi')).getByText('Notiz:').parentElement!.textContent).toBe('Notiz: geht 14 Uhr statt 15 Uhr');
  });

  it('dazu steht, wer es eingetragen hat', async () => {
    await oeffne();
    const eingetragen = urheberZeile(ABGEMELDET)!;
    const notiz = notizUrheberZeile(MIT_NOTIZ)!;
    expect(eingetragen).toMatch(/^Eingetragen von Pastor Luthe/);
    expect(notiz).toMatch(/^Notiz von Pastor Luthe/);
    expect(within(zeileVon('Ole Abgemeldet')).getByText(eingetragen)).toBeInTheDocument();
    expect(within(zeileVon('Kim Konfi')).getByText(notiz)).toBeInTheDocument();
  });

  it('ein Check-in per QR-Code weist sich auch hier aus', async () => {
    await oeffne();
    const zeile = checkinZeile(PER_QR)!;
    expect(zeile).toMatch(/^Eingecheckt per QR-Code/);
    expect(within(zeileVon('Mia Eingecheckt')).getByText(zeile)).toBeInTheDocument();
  });

  it('ohne Grund und Notiz stehen die Zeilen nicht leer da', async () => {
    await oeffne();
    const mia = zeileVon('Mia Eingecheckt');
    expect(within(mia).queryByText('Abgemeldet:')).toBeNull();
    expect(within(mia).queryByText('Notiz:')).toBeNull();
  });

  it('das Team bekommt dadurch keine Knöpfe zum Verbuchen', async () => {
    await oeffne();
    expect(within(abschnitt(/^Wer kommt/)!).queryAllByRole('button')).toHaveLength(0);
  });
});
