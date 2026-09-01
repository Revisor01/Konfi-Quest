import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 01.09.2026 (API-Konsolidierungspruefung): GET /konfi/events holte
// `SELECT e.*` und reichte die Zeile mit `...row` unveraendert weiter --
// inklusive `qr_token`.
//
// Genau diese Luecke wurde am 22.08.2026 fuer GET /events geschlossen
// (routes/events/lesen.js: `const { qr_token: _qrToken, ...rowOhneToken }`).
// Die KONFI-Liste wurde dabei uebersehen: Der Schutz war ueber sie weiter
// umgehbar.
//
// Warum das zaehlt: Mit dem Token kann sich eine Konfi per
// POST /events/qr-checkin von zu Hause als anwesend eintragen und sich
// Punkte gutschreiben, ohne beim Termin gewesen zu sein.
//
// Der Test liest die Quelle, statt die Route zu rufen: Ob das Feld
// durchrutscht, haengt an der Form der Abfrage -- und die faellt hier auf,
// bevor jemand sie ausrollt.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('qr_token verlaesst die Konfi-Routen nicht', () => {
  it('GET /konfi/events entfernt den Token vor dem Ausliefern', () => {
    const quelle = lies('../backend/routes/konfi.js');
    expect(quelle).toContain('qr_token: _qrToken');
  });

  it('GET /events tut es weiterhin (Regression zum Fix vom 22.08.2026)', () => {
    const quelle = lies('../backend/routes/events/lesen.js');
    expect(quelle).toContain('qr_token: _qrToken');
  });
});
