import { describe, it, expect, vi } from 'vitest';
import { offlineBlockiert, OFFLINE_AKTION_MELDUNG } from '../../utils/offlineAktion';

// Stilles Scheitern (Audit 25.08.2026): Viele Aktionen prüften
// `if (!isOnline) return;` ohne jede Rückmeldung — der Tipp verpuffte stumm.
// Der Helfer ersetzt das Muster: offline -> Meldung + true (Abbruch),
// online -> false (Aktion läuft normal).

describe('offlineBlockiert', () => {
  it('offline: zeigt die Meldung und blockiert (true)', () => {
    const setError = vi.fn();
    const blockiert = offlineBlockiert(false, setError);

    expect(blockiert).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith(OFFLINE_AKTION_MELDUNG);
  });

  it('online: keine Meldung, blockiert nicht (false)', () => {
    const setError = vi.fn();
    const blockiert = offlineBlockiert(true, setError);

    expect(blockiert).toBe(false);
    expect(setError).toHaveBeenCalledTimes(0);
  });

  it('Meldung nennt die Verbindung als Grund', () => {
    expect(OFFLINE_AKTION_MELDUNG).toBe(
      'Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.'
    );
  });
});
