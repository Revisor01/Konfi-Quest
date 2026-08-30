import { describe, it, expect } from 'vitest';
import type { BonusEintrag } from '../../types/user';

// Befund 30.08.2026: In der Konfi-Detailansicht der Leitung stand unter jedem
// Bonuspunkt-Eintrag das Wort "Admin" statt des Namens der Person, die die
// Punkte vergeben hat.
//
// Ursache: Die Liste las `bonus.admin`. Die Antwort
// (GET /admin/konfis/:id -> bonusPoints) liefert den Namen aber als
// `admin_name` -- die Abfrage aliast `u.display_name as admin_name`
// (backend/routes/konfi-management.js:553). `bonus.admin` war immer
// undefined, und der Rueckfall `|| 'Admin'` machte daraus stillschweigend
// einen plausibel aussehenden Text. Genau deshalb fiel es nie auf.
//
// Dasselbe galt fuer das Datum: der Rueckfall ging auf `bonus.date`, ein Feld,
// das es in dieser Antwort nicht gibt. Er greift jetzt auf created_at.

// So liefert das Backend einen Eintrag:
const eintrag: BonusEintrag = {
  id: 7,
  points: 3,
  type: 'gemeinde',
  description: 'Krippenspiel aufgebaut',
  completed_date: '2026-08-20',
  created_at: '2026-08-21T10:00:00.000Z',
  admin_id: 2,
  admin_name: 'Simon Luthe',
};

// FALSCH (bis 30.08.2026)
const alteAnzeige = (b: BonusEintrag) =>
  (b as unknown as { admin?: string }).admin || 'Admin';
// RICHTIG
const vergebenVon = (b: BonusEintrag) => b.admin_name || 'Admin';

const datumAnzeige = (b: BonusEintrag) => b.completed_date || b.created_at || '';

describe('Bonuspunkte: wer hat vergeben', () => {
  it('zeigt den Namen aus admin_name', () => {
    expect(vergebenVon(eintrag)).toBe('Simon Luthe');
  });

  it('zeigte mit dem alten Feldnamen immer nur "Admin"', () => {
    expect(alteAnzeige(eintrag)).toBe('Admin');
  });

  it('faellt ohne Namen auf "Admin" zurueck', () => {
    const ohneNamen: BonusEintrag = { ...eintrag, admin_name: undefined };
    expect(vergebenVon(ohneNamen)).toBe('Admin');
  });
});

describe('Bonuspunkte: Datum', () => {
  it('nimmt completed_date', () => {
    expect(datumAnzeige(eintrag)).toBe('2026-08-20');
  });

  it('faellt ohne completed_date auf created_at zurueck', () => {
    const ohneDatum: BonusEintrag = { ...eintrag, completed_date: undefined };
    expect(datumAnzeige(ohneDatum)).toBe('2026-08-21T10:00:00.000Z');
  });

  it('liefert ohne beide Felder einen leeren Text statt undefined', () => {
    const leer: BonusEintrag = { id: 8, points: 1, type: 'gottesdienst' };
    expect(datumAnzeige(leer)).toBe('');
  });
});
