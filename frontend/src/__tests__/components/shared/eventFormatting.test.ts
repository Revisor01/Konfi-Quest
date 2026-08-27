import { describe, it, expect } from 'vitest';
import {
  formatEventDate,
  formatEventTime,
  formatEventDateLong,
  eventEnde,
  istVergangen,
} from '../../../components/shared/eventFormatting';

// Fixe Zeit für deterministische Erwartungen (lokale Zeitzone-unabhaengig
// prüfen wir nur Format/Stabilitaet, nicht exakte Uhrzeit-Verschiebung).
const ISO = '2026-06-14T18:30:00';

describe('formatEventDate', () => {
  it('formatiert TT.MM.JJJJ', () => {
    expect(formatEventDate(ISO)).toBe('14.06.2026');
  });
});

describe('formatEventTime', () => {
  it('formatiert HH:MM', () => {
    expect(formatEventTime(ISO)).toMatch(/^\d{2}:\d{2}$/);
  });
  it('liefert leeren String bei leerer Eingabe', () => {
    expect(formatEventTime('')).toBe('');
  });
  it('liefert leeren String bei ungueltiger Eingabe', () => {
    expect(formatEventTime('kein-datum')).toBe('');
  });
});

describe('formatEventDateLong', () => {
  it('enthaelt Wochentag und ausgeschriebenen Monat', () => {
    const out = formatEventDateLong(ISO);
    expect(out).toContain('Juni');
    // Wochentag (Sonntag) am Anfang
    expect(out).toMatch(/^[A-Za-zäöü]+,/);
  });
});

// Befund N6 (27.08.2026): Ob ein Termin vergangen ist, wurde an ELF Stellen
// einzeln gerechnet -- und nur an einer davon richtig. Zehn nutzten allein
// event_date (den START), obwohl mehrtaegige Termine erst nach
// event_end_time vorbei sind.
//
// Konkret: Bei einer Freizeit vom 10. bis 14. sagte die Konfi-Liste am 11.
// noch "laeuft", die Detailansicht desselben Termins schon "vergangen".
describe('istVergangen (Befund N6)', () => {
  // Feste Uhr, damit die Faelle unabhaengig vom Testzeitpunkt gelten.
  const jetzt = new Date('2026-06-11T12:00:00');

  const eintaegigVorbei = { event_date: '2026-06-10T18:00:00' };
  const eintaegigKuenftig = { event_date: '2026-06-20T18:00:00' };
  const mehrtaegigLaufend = {
    event_date: '2026-06-10T09:00:00',
    event_end_time: '2026-06-14T16:00:00',
  };
  const mehrtaegigVorbei = {
    event_date: '2026-06-01T09:00:00',
    event_end_time: '2026-06-05T16:00:00',
  };

  it('ein laufender mehrtaegiger Termin ist NICHT vergangen', () => {
    // Der Kern des Befunds: Nach event_date waere er es, nach event_end_time
    // nicht. Genau hier widersprachen sich Liste und Detail.
    expect(istVergangen(mehrtaegigLaufend, jetzt)).toBe(false);
  });

  it('ein abgeschlossener mehrtaegiger Termin ist vergangen', () => {
    expect(istVergangen(mehrtaegigVorbei, jetzt)).toBe(true);
  });

  it('eintaegige Termine richten sich weiter nach event_date', () => {
    // Gegenprobe: Ohne event_end_time darf sich nichts aendern.
    expect(istVergangen(eintaegigVorbei, jetzt)).toBe(true);
    expect(istVergangen(eintaegigKuenftig, jetzt)).toBe(false);
  });

  it('ein leeres event_end_time faellt auf event_date zurueck', () => {
    // Kommt aus der Datenbank als null; ein leerer String wuerde sonst ein
    // ungueltiges Datum ergeben und JEDEN Vergleich falsch machen.
    expect(istVergangen({ ...eintaegigVorbei, event_end_time: null }, jetzt)).toBe(true);
    expect(istVergangen({ ...eintaegigKuenftig, event_end_time: undefined }, jetzt)).toBe(false);
  });
});

describe('eventEnde', () => {
  it('nimmt event_end_time, wenn vorhanden', () => {
    const ende = eventEnde({ event_date: '2026-06-10T09:00:00', event_end_time: '2026-06-14T16:00:00' });
    expect(ende.getTime()).toBe(new Date('2026-06-14T16:00:00').getTime());
  });

  it('nimmt sonst event_date', () => {
    const ende = eventEnde({ event_date: '2026-06-10T09:00:00' });
    expect(ende.getTime()).toBe(new Date('2026-06-10T09:00:00').getTime());
  });
});
