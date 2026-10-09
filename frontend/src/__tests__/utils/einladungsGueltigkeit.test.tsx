// Gerüst zuerst: es registriert die Attrappen, bevor die Seite geladen wird.
import {
  zustand, api, zuruecksetzen, seiteOeffnen, einladung, imDialogDruecken, letzterDialog, inTagen as abHeute,
} from '../components/gerueste/einladungSeite';

// Einladungscodes: Gueltigkeit waehlbar, Verlaengern waehlbar, immer mit
// Ablauf (Audit 26.09.2026, feature-empfehlungen E-08).
//
// Simon, 28.09.2026: "codes laenger als 7 Tage ist gut. Mach es flexibel.
// Aber mit Zwang die ablaufen zu lassen."
//
// Seit dem 09.10.2026 prueft der letzte Block die echte Seite gerendert
// (vorher ihren Quelltext), und der Abgleich mit dem Backend vergleicht die
// Werte des Backend-Moduls statt seines Quelltexts.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createRequire } from 'module';
import { resolve } from 'path';
import {
  GUELTIGKEIT_TAGE,
  STANDARD_TAGE,
  HOECHSTENS_TAGE,
  gueltigkeitText,
  istGueltigkeitTage,
  verlaengerungsOptionen
} from '../../utils/einladungsGueltigkeit';

const TAG = 24 * 60 * 60 * 1000;
const jetzt = new Date('2026-09-29T10:00:00Z');
const inTagen = (tage: number) => new Date(jetzt.getTime() + tage * TAG);

describe('Stufen der Gueltigkeit', () => {
  it('7, 14, 30, 60 und 90 Tage -- dieselben wie im Backend, Standard 7, Grenze 90', () => {
    expect([...GUELTIGKEIT_TAGE]).toEqual([7, 14, 30, 60, 90]);
    expect(STANDARD_TAGE).toBe(7);
    expect(HOECHSTENS_TAGE).toBe(90);
    const backend = createRequire(import.meta.url)(resolve(process.cwd(), '../backend/utils/einladungsGueltigkeit.js')) as {
      GUELTIGKEIT_TAGE: readonly number[]; STANDARD_TAGE: number; HOECHSTENS_TAGE: number;
    };
    expect([...backend.GUELTIGKEIT_TAGE]).toEqual([...GUELTIGKEIT_TAGE]);
    expect(backend.STANDARD_TAGE).toBe(STANDARD_TAGE);
    expect(backend.HOECHSTENS_TAGE).toBe(HOECHSTENS_TAGE);
  });

  it('keine Stufe ohne Ablauf', () => {
    for (const tage of GUELTIGKEIT_TAGE) {
      expect(Number.isInteger(tage)).toBe(true);
      expect(tage).toBeGreaterThan(0);
      expect(tage).toBeLessThanOrEqual(HOECHSTENS_TAGE);
    }
    expect(istGueltigkeitTage(0)).toBe(false);
    expect(istGueltigkeitTage(Infinity)).toBe(false);
    expect(istGueltigkeitTage(365)).toBe(false);
    expect(istGueltigkeitTage('30')).toBe(false);
    expect(istGueltigkeitTage(30)).toBe(true);
  });

  it('Beschriftung', () => {
    expect(gueltigkeitText(14)).toBe('14 Tage');
  });
});

describe('verlaengerungsOptionen', () => {
  it('bei 3 Resttagen: alle Stufen, die unter der Grenze bleiben, dann eine gekuerzte bis 90 Tage ab heute', () => {
    const optionen = verlaengerungsOptionen(inTagen(3), jetzt);
    expect(optionen.map((o) => [o.tage, o.begrenzt])).toEqual([[7, false], [14, false], [30, false], [60, false], [90, true]]);
    expect(optionen[0].neuesAblaufdatum.getTime()).toBe(inTagen(10).getTime());
    expect(optionen[3].neuesAblaufdatum.getTime()).toBe(inTagen(63).getTime());
    expect(optionen[4].neuesAblaufdatum.getTime()).toBe(inTagen(90).getTime());
    expect(optionen[0].text).toBe('7 Tage — bis 09.10.2026');
    expect(optionen[4].text).toBe('Bis 28.12.2026 — länger als 90 Tage geht nicht');
  });

  it('bei 85 Resttagen: nur noch eine Stufe, gekuerzt -- die groesseren bringen nichts mehr', () => {
    const optionen = verlaengerungsOptionen(inTagen(85), jetzt);
    expect(optionen).toHaveLength(1);
    expect(optionen[0]).toMatchObject({ tage: 7, begrenzt: true });
    expect(optionen[0].neuesAblaufdatum.getTime()).toBe(inTagen(90).getTime());
  });

  it('an der Grenze (weniger als ein Tag Luft): keine Stufe -- die App sagt, dass es nicht laenger geht', () => {
    expect(verlaengerungsOptionen(inTagen(90), jetzt)).toEqual([]);
    expect(verlaengerungsOptionen(inTagen(89.5), jetzt)).toEqual([]);
  });

  it('genau ein Tag Luft reicht fuer eine gekuerzte Stufe', () => {
    const optionen = verlaengerungsOptionen(inTagen(89), jetzt);
    expect(optionen.map((o) => [o.tage, o.begrenzt])).toEqual([[7, true]]);
  });
});

describe('AdminInvitePage: Auswahl beim Anlegen und beim Verlaengern', () => {
  beforeEach(zuruecksetzen);
  afterEach(() => cleanup());

  const gueltigkeit = () => screen.getByRole('combobox', { name: 'Gültigkeit' }) as HTMLSelectElement;
  const erzeugen = async () => { await act(async () => { fireEvent.click(screen.getByText('Einladungslink generieren')); }); };

  it('bietet genau die Stufen an, vorgewaehlt ist der Standard', async () => {
    await seiteOeffnen();
    const optionen = [...gueltigkeit().options].filter((o) => o.value !== '');
    expect(optionen.map((o) => [o.value, o.textContent])).toEqual([
      ['7', '7 Tage'], ['14', '14 Tage'], ['30', '30 Tage'], ['60', '60 Tage'], ['90', '90 Tage'],
    ]);
    expect(gueltigkeit().value).toBe('7');
  });

  it('schickt die gewaehlte Gueltigkeit beim Anlegen mit', async () => {
    api.post.mockResolvedValue({ data: { invite_code: 'NEU1' } });
    await seiteOeffnen();
    await act(async () => { fireEvent.change(gueltigkeit(), { target: { value: '60' } }); });
    await erzeugen();
    expect(api.post).toHaveBeenCalledWith('/auth/invite-code', { jahrgang_id: 1, gueltig_tage: 60 });
  });

  it('ohne Wahl gilt der Standard von 7 Tagen', async () => {
    api.post.mockResolvedValue({ data: { invite_code: 'NEU1' } });
    await seiteOeffnen();
    await erzeugen();
    expect(api.post).toHaveBeenCalledWith('/auth/invite-code', { jahrgang_id: 1, gueltig_tage: 7 });
  });

  it('fragt beim Verlaengern nach den Tagen und schickt sie mit', async () => {
    zustand.einladungen = [einladung(3, { expires_at: abHeute(3) })];
    api.post.mockResolvedValue({ data: { expires_at: abHeute(33) } });
    await seiteOeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einladung verlängern' })); });
    // Die Wisch-Aktion verlaengert nicht ungefragt: erst die Rueckfrage.
    expect(api.post).not.toHaveBeenCalled();
    const dialog = letzterDialog();
    expect(dialog.header).toBe('Einladung verlängern');
    expect(dialog.inputs!.map((i) => [i.type, i.value, i.checked])).toEqual([
      ['radio', 7, true], ['radio', 14, false], ['radio', 30, false], ['radio', 60, false], ['radio', 90, false],
    ]);
    expect(dialog.inputs![4].label).toMatch(/^Bis \d\d\.\d\d\.\d{4} — länger als 90 Tage geht nicht$/);
    await imDialogDruecken('Verlängern', 30);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/auth/invite-codes/3/extend', { tage: 30 });
  });

  it('ein ungueltiger oder fehlender Wert aus dem Dialog schickt nichts', async () => {
    zustand.einladungen = [einladung(3, { expires_at: abHeute(3) })];
    await seiteOeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einladung verlängern' })); });
    await imDialogDruecken('Verlängern', 365);
    await imDialogDruecken('Verlängern', undefined);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('an der Grenze: kein Auswahl-Dialog, sondern der Satz, dass es nicht laenger geht', async () => {
    zustand.einladungen = [einladung(4, { expires_at: abHeute(90) })];
    await seiteOeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Einladung verlängern' })); });
    expect(letzterDialog().inputs).toBeUndefined();
    expect(letzterDialog().message).toBe('Der Code gilt schon 90 Tage im Voraus — länger geht es nicht.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('der Hinweis spricht nicht von festen 7 Tagen', async () => {
    await seiteOeffnen();
    expect(screen.queryByText(/Einladungscodes sind 7 Tage gültig/)).toBeNull();
    expect(screen.getByText(/^Einladungscodes gelten je nach Wahl 7 bis 90 Tage und laufen immer ab\./)).toBeTruthy();
  });
});
