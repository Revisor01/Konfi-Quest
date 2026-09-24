import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/*
 * Termin-Pushes muessen die Kennung MITSENDEN — nicht nur lesen koennen.
 *
 * WARUM ES DIESEN TEST GIBT (24.09.2026): Am selben Tag wurde die Weiche im
 * Frontend (utils/pushNavigation.ts) so geaendert, dass sie `event_id` liest
 * und zum Termin fuehrt statt zur Liste. Der Frontend-Test dazu war gruen —
 * er ruft `buildPushTargetUrl` aber direkt mit `{event_id: 7}` auf und misst
 * damit die Weiche, nicht den Versand.
 *
 * In der Produktion lief der Push trotzdem auf die Liste: `event_attendance`
 * uebergab an ALLEN SIEBEN Aufrufstellen ein hartes `null`, und drei weitere
 * Typen hatten gar keinen eventId-Parameter. Genau der Fall aus CLAUDE.md:
 * "Ein gruener Test beweist nichts, wenn er den Fehlerfall nicht erreicht."
 *
 * Deshalb prueft dieser Test die AUFRUFSTELLEN am Quelltext. Ein Laufzeittest
 * wuerde hier wenig helfen: Er muesste jede der zwoelf Stellen einzeln durch
 * ihre Route ansteuern, und ein vergessener Aufruf faellt trotzdem durch.
 */

const lies = (pfad) => readFileSync(resolve(__dirname, '../..', pfad), 'utf-8');

describe('Termin-Pushes senden die Kennung mit', () => {
  it('sendEventAttendanceToKonfi uebergibt nirgends mehr null', () => {
    for (const datei of ['routes/events/checkin.js', 'routes/events/anwesenheit.js']) {
      const quelle = lies(datei);
      const aufrufe = quelle.match(/sendEventAttendanceToKonfi\([^;]*?\)/gs) || [];
      expect(aufrufe.length, `${datei} hat keine Aufrufe mehr?`).toBeGreaterThan(0);
      for (const a of aufrufe) {
        expect(a, `${datei}: Aufruf uebergibt null statt der Kennung`).not.toMatch(
          /,\s*null,\s*req\.user\.organization_id/
        );
      }
    }
  });

  it('die vier nachgezogenen Typen haben einen eventId-Parameter', () => {
    const quelle = lies('services/pushService.js');
    for (const fn of [
      'sendEventUnregisteredToKonfi',
      'sendEventReminderToKonfi',
      'sendEventOptOutToAdmins',
      'sendEventOptInToAdmins',
    ]) {
      const sig = quelle.match(new RegExp(`static async ${fn}\\(([^)]*)\\)`));
      expect(sig, `${fn}: Signatur nicht gefunden`).not.toBeNull();
      expect(sig[1], `${fn}: kein eventId-Parameter`).toContain('eventId');
    }
  });

  it('die vier Typen packen event_id auch in die Push-Daten', () => {
    const quelle = lies('services/pushService.js');
    for (const typ of [
      'event_unregistered',
      'event_reminder',
      'event_opt_out',
      'event_opt_in',
    ]) {
      // Der Datenblock reicht vom type-Eintrag bis zur schliessenden Klammer.
      const block = quelle.match(new RegExp(`type: '${typ}',[\\s\\S]{0,400}?\\n        \\}`));
      expect(block, `${typ}: Datenblock nicht gefunden`).not.toBeNull();
      expect(block[0], `${typ}: sendet keine event_id`).toContain('event_id');
    }
  });

  it('die Aufrufstellen der vier Typen uebergeben die Kennung', () => {
    const konfi = lies('routes/konfi.js');
    for (const fn of [
      'sendEventUnregisteredToKonfi',
      'sendEventOptOutToAdmins',
      'sendEventOptInToAdmins',
    ]) {
      // Bis zum Semikolon statt bis zur ersten Klammer: `reason.trim()` haette
      // ein nicht-gieriges Muster sonst vorzeitig beendet.
      const aufruf = konfi.match(new RegExp(`${fn}\\([^;]*`, 's'));
      expect(aufruf, `${fn}: Aufruf in konfi.js nicht gefunden`).not.toBeNull();
      expect(aufruf[0], `${fn}: uebergibt keine Kennung`).toContain('eventId');
    }

    const hintergrund = lies('services/backgroundService.js');
    const erinnerungen = hintergrund.match(/sendEventReminderToKonfi\([^;]*?\)/gs) || [];
    expect(erinnerungen.length, 'keine Erinnerungs-Aufrufe gefunden').toBe(2);
    for (const a of erinnerungen) {
      expect(a, 'Erinnerung uebergibt keine Kennung').toContain('event.id');
    }
  });
});
