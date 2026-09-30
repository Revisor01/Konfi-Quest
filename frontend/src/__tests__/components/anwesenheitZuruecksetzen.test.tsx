// "Eintrag zurücksetzen" steht im Menü -- und nur bei gesetztem Eintrag
// (16.09.2026) -- gerendert (Audit Tests 26.09.2026, BF-02; vorher
// Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Befund: Eine eingetragene Abmeldung ließ sich nicht mehr
// zurücknehmen. Das Backend kann es (attendance_status null); dieser Test
// hält fest, dass die Oberfläche den Weg auch anbietet -- und dass sie ihn
// NICHT anbietet, wo es nichts zurückzusetzen gibt.
//
// Gerendert wird die Leitungsansicht; der Tipp auf eine Teilnehmerzeile
// öffnet das Aktionsmenü, das mitgeschrieben wird.
import { describe, it, expect, beforeEach } from 'vitest';
import { within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, zeileVon, api, letztesMenue, knopfIn,
} from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

const menueFuer = async (zusatz: Record<string, unknown>) => {
  zustand.detail = termin({ participants: [teilnahme(1, 'Kim Konfi', zusatz)] });
  await oeffne();
  await act(async () => { fireEvent.click(zeileVon('Kim Konfi')); });
  return letztesMenue();
};

describe('Aktionsmenü der Teilnehmerliste: Eintrag zurücksetzen', () => {
  it.each([
    ['anwesend', 'present'],
    ['abwesend', 'absent'],
    ['abgemeldet (nachgetragen)', 'excused'],
  ])('bietet den Eintrag an, wenn die Person %s verbucht ist', async (_name, status) => {
    const menue = await menueFuer({ attendance_status: status });
    expect(knopfIn(menue, 'Eintrag zurücksetzen')).toBeDefined();
  });

  it('bietet ihn NICHT an, wenn noch nichts eingetragen ist', async () => {
    const menue = await menueFuer({ attendance_status: null });
    expect(menue.header).toBe('Kim Konfi');
    expect(knopfIn(menue, 'Eintrag zurücksetzen')).toBeUndefined();
    // Gegenprobe, dass es das richtige Menü ist:
    expect(knopfIn(menue, 'Anwesend')).toBeDefined();
  });

  it('ist als folgenschwer gekennzeichnet', async () => {
    const menue = await menueFuer({ attendance_status: 'present' });
    expect(knopfIn(menue, 'Eintrag zurücksetzen')!.role).toBe('destructive');
  });

  it('schickt null, nicht einen vierten Status -- und die Zeile steht wieder als unverbucht da', async () => {
    const menue = await menueFuer({ attendance_status: 'present' });
    expect(within(zeileVon('Kim Konfi')).getByRole('img').getAttribute('aria-label')).toBe('Anwesend');
    await act(async () => { await knopfIn(menue, 'Eintrag zurücksetzen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/participants/1/attendance', { attendance_status: null });
    expect(within(zeileVon('Kim Konfi')).getByRole('img').getAttribute('aria-label')).toBe('Gebucht');
  });
});
