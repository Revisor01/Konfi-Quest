// backend/tests/services/erstlaufOhneAbsturz.test.js
//
// Befund: startEventReminderService und startTokenCleanupService riefen ihren
// ERSTLAUF nackt auf — ohne await, ohne .catch(). Beide Methoden werfen den
// Fehler am Ende weiter (rethrow). Eine abgelehnte Promise ohne Handler beendet
// den Node-Prozess; mit `restart: unless-stopped` wird daraus eine
// Neustartschleife. Weil nur die Cron-Leader-Replica die Hintergrund-Jobs
// startet, antwortet die zweite Replica dabei weiter — der Ausfall bleibt von
// aussen unsichtbar, waehrend Erinnerungen, Token-Cleanup, Auto-Loeschung und
// APM stillstehen.
//
// Die setInterval-Takte darunter waren schon korrekt in try/catch; die beiden
// anderen Dienste derselben Datei (Registration-Open, Challenge-Start) hatten
// beim Erstlauf schon ein .catch(). Es war eine Inkonsistenz, keine Entscheidung.
//
// MESSPUNKT: Ein echter unhandledRejection-Listener. Der Test laesst die erste
// db.query des Erstlaufs werfen und prueft, dass KEINE unbehandelte Ablehnung
// entsteht und der Fehler stattdessen geloggt wird.
//
// GEGENPROBE (dokumentiert): Nimmt man das .catch() an
// backgroundService.js:323 bzw. :702 wieder weg, fallen die beiden
// "verboten"-Tests mit einer registrierten unhandledRejection.
const BackgroundService = require('../../services/backgroundService');

// Sammelt unhandledRejection-Ereignisse waehrend eines Codeabschnitts ein.
// Das ist der einzige harte Nachweis: genau dieses Ereignis beendet in
// Produktion den Prozess (Node-Standard seit 15, Dockerfile: node:26).
async function sammleUnhandledRejections(fn) {
  const gesammelt = [];
  const listener = (grund) => gesammelt.push(grund);

  // Vorhandene Listener (vitest/setupTests) abhaengen, damit sie die Ablehnung
  // nicht vorher wegfangen — danach exakt wiederherstellen.
  const vorhandene = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', listener);

  try {
    fn();
    // Zwei Makrotask-Ticks: Node feuert unhandledRejection erst, wenn die
    // Microtask-Queue leer ist und niemand einen Handler nachgereicht hat.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
  } finally {
    process.removeListener('unhandledRejection', listener);
    for (const l of vorhandene) process.on('unhandledRejection', l);
  }

  return gesammelt;
}

// Minimal-db, dessen query() kontrolliert wirft oder liefert.
function machDb({ wirft }) {
  return {
    query: async () => {
      if (wirft) throw new Error('DB weg (simuliert)');
      return { rows: [] };
    },
  };
}

describe('Erstlauf der Hintergrund-Dienste ueberlebt einen DB-Fehler', () => {
  let fehlerLog;
  let originalError;

  beforeEach(() => {
    fehlerLog = [];
    originalError = console.error;
    console.error = (...args) => fehlerLog.push(args.map(String).join(' '));
  });

  afterEach(() => {
    console.error = originalError;
    // Intervalle wieder abraeumen, sonst haelt der Timer die Suite offen.
    BackgroundService.stopEventReminderService();
    BackgroundService.stopTokenCleanupService();
  });

  describe('verboten: unbehandelte Ablehnung (der eigentliche Befund)', () => {
    it('startEventReminderService erzeugt bei DB-Fehler KEINE unhandledRejection', async () => {
      const db = machDb({ wirft: true });

      const abgelehnt = await sammleUnhandledRejections(() => {
        BackgroundService.startEventReminderService(db);
      });

      expect(abgelehnt).toHaveLength(0);
      expect(
        fehlerLog.some((z) => z.includes('Event reminder (initial) failed'))
      ).toBe(true);
    });

    it('startTokenCleanupService erzeugt bei DB-Fehler KEINE unhandledRejection', async () => {
      const db = machDb({ wirft: true });

      const abgelehnt = await sammleUnhandledRejections(() => {
        BackgroundService.startTokenCleanupService(db);
      });

      expect(abgelehnt).toHaveLength(0);
      expect(
        fehlerLog.some((z) => z.includes('Token cleanup (initial) failed'))
      ).toBe(true);
    });
  });

  describe('erlaubt: normaler Lauf', () => {
    it('startEventReminderService laeuft ohne Fehler still durch', async () => {
      const db = machDb({ wirft: false });

      const abgelehnt = await sammleUnhandledRejections(() => {
        BackgroundService.startEventReminderService(db);
      });

      expect(abgelehnt).toHaveLength(0);
      expect(fehlerLog).toHaveLength(0);
      // Der Takt laeuft: Intervall ist gesetzt.
      expect(BackgroundService.eventReminderInterval).not.toBeNull();
    });

    it('startTokenCleanupService laeuft ohne Fehler still durch', async () => {
      const db = machDb({ wirft: false });

      const abgelehnt = await sammleUnhandledRejections(() => {
        BackgroundService.startTokenCleanupService(db);
      });

      expect(abgelehnt).toHaveLength(0);
      expect(fehlerLog).toHaveLength(0);
      expect(BackgroundService.tokenCleanupInterval).not.toBeNull();
    });
  });

  describe('Konsistenz: alle vier Erstlaeufe sind abgesichert', () => {
    // Die beiden anderen Dienste starten ihren Erstlauf verzoegert per
    // setTimeout(30s) — hier wird nicht der Ablauf geprueft, sondern dass die
    // Methoden selbst eine Promise liefern, deren Ablehnung abgefangen werden
    // KANN (also nicht synchron werfen und nicht undefined liefern).
    it('sendEventReminders und cleanupStaleTokens liefern eine Promise', () => {
      const db = machDb({ wirft: true });

      const p1 = BackgroundService.sendEventReminders(db);
      const p2 = BackgroundService.cleanupStaleTokens(db);

      expect(typeof p1.catch).toBe('function');
      expect(typeof p2.catch).toBe('function');

      // Sofort abfangen, sonst erzeugt der Test selbst die Ablehnung.
      p1.catch(() => {});
      p2.catch(() => {});
    });

    it('sendEventReminders wirft den Fehler wirklich weiter (Grundlage des Befunds)', async () => {
      const db = machDb({ wirft: true });
      await expect(BackgroundService.sendEventReminders(db)).rejects.toThrow('DB weg (simuliert)');
    });

    it('cleanupStaleTokens wirft den Fehler wirklich weiter (Grundlage des Befunds)', async () => {
      const db = machDb({ wirft: true });
      await expect(BackgroundService.cleanupStaleTokens(db)).rejects.toThrow('DB weg (simuliert)');
    });
  });
});
