import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 30.08.2026: Das Verlaengern einer Einladung merkte sich zwar in
// extendingInvite, welche Einladung gerade laeuft, zeigte das aber nirgends.
// Wer wischte, sah das Element zuklappen und danach nichts — bei langsamer
// Verbindung wischte man ein zweites Mal und schickte den Aufruf doppelt.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const seite = lies('src/components/admin/pages/AdminInvitePage.tsx');

describe('Einladung verlaengern: Rueckmeldung waehrend des Aufrufs', () => {
  it('merkt sich weiterhin, welche Einladung gerade laeuft', () => {
    expect(seite).toContain('setExtendingInvite(inviteId);');
    expect(seite).toContain('setExtendingInvite(null);');
  });

  it('sperrt die Wisch-Aktion der laufenden Einladung', () => {
    expect(seite).toContain('disabled={extendingInvite === invite.id}');
  });

  it('zeigt an ihrer Stelle den Spinner statt des Uhr-Symbols', () => {
    expect(seite).toContain('extendingInvite === invite.id\n                                  ? <IonSpinner name="crescent" />\n                                  : <IonIcon icon={time} />');
  });

  it('sperrt nur die laufende Einladung, nicht die ganze Liste', () => {
    // Ein blosses disabled={!!extendingInvite} wuerde alle Zeilen sperren.
    expect(seite).not.toContain('disabled={!!extendingInvite}');
  });
});
