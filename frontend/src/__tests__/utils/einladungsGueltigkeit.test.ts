// Einladungscodes: Gueltigkeit waehlbar, Verlaengern waehlbar, immer mit
// Ablauf (Audit 26.09.2026, feature-empfehlungen E-08).
//
// Simon, 28.09.2026: "codes laenger als 7 Tage ist gut. Mach es flexibel.
// Aber mit Zwang die ablaufen zu lassen."
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
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
    const backend = readFileSync(resolve(process.cwd(), '../backend/utils/einladungsGueltigkeit.js'), 'utf8');
    expect(backend).toContain('const GUELTIGKEIT_TAGE = Object.freeze([7, 14, 30, 60, 90]);');
    expect(backend).toContain('const STANDARD_TAGE = 7;');
    expect(backend).toContain('const HOECHSTENS_TAGE = 90;');
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
  const seite = readFileSync(resolve(process.cwd(), 'src/components/admin/pages/AdminInvitePage.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('schickt die gewaehlte Gueltigkeit beim Anlegen mit', () => {
    expect(seite).toContain('gueltig_tage: gueltigTage');
    expect(seite).toContain('useState<GueltigkeitTage>(STANDARD_TAGE)');
    expect(seite).toContain('<IonSelect aria-label="Gültigkeit"');
    expect(seite).toContain('{GUELTIGKEIT_TAGE.map((tage) => (');
  });

  it('fragt beim Verlaengern nach den Tagen und schickt sie mit', () => {
    expect(seite).toContain('waehleVerlaengerung(invite);');
    expect(seite).toContain('verlaengerungsOptionen(new Date(invite.expires_at))');
    expect(seite).toContain("type: 'radio' as const");
    expect(seite).toContain('api.post(`/auth/invite-codes/${inviteId}/extend`, { tage })');
    // Die Wisch-Aktion verlaengert nicht mehr ungefragt um 7 Tage.
    expect(seite).not.toContain('extendInvite(invite.id); }}');
  });

  it('der Hinweis spricht nicht mehr von festen 7 Tagen', () => {
    expect(seite).not.toContain('Einladungscodes sind 7 Tage gültig');
    expect(seite).toContain('Einladungscodes gelten je nach Wahl 7 bis 90 Tage und laufen immer ab.');
  });
});
