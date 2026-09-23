// Gegenstueck zu pushZielUebergabe.test.ts: Dort wird das Ziel gemeldet, hier
// wird es eingeloest — ueber den Router, nicht ueber einen Neuaufbau der App
// (Maltes Absturz beim Antippen eines Pushes auf Android, 23.09.2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const push = vi.fn();

vi.mock('@ionic/react', () => ({
  useIonRouter: () => ({ push }),
}));

import PushZielNavigation from '../../navigation/PushZielNavigation';
import { pushZielMelden, pushZielAbholen, PUSH_ZIEL_EVENT } from '../../utils/pushNavigation';

describe('PushZielNavigation', () => {
  beforeEach(() => {
    push.mockClear();
    pushZielAbholen(); // Merker leeren
  });

  it('navigiert auf ein gemeldetes Ziel — mit Stack-Reset, ohne Reload', async () => {
    render(<PushZielNavigation />);
    expect(push).toHaveBeenCalledTimes(0);

    pushZielMelden('/konfi/chat/room/5');

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    // 'root'/'replace' wie im OrgSwitcherButton: Der Seiten-Stack des alten
    // Standes wird geleert, damit im WebView keine gecachte Seite stehenbleibt.
    expect(push).toHaveBeenCalledWith('/konfi/chat/room/5', 'root', 'replace');
  });

  it('holt ein bereits wartendes Ziel beim Montieren nach', async () => {
    // Genau der Fall nach einem Org-Wechsel: orgVersion steigt, der
    // Router-Subtree wird neu montiert, und das Ereignis fiel in die Luecke.
    pushZielMelden('/teamer/events');
    render(<PushZielNavigation />);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/teamer/events', 'root', 'replace');
  });

  it('navigiert nach dem Einloesen nicht erneut auf dasselbe Ziel', async () => {
    pushZielMelden('/admin/requests');
    const { unmount } = render(<PushZielNavigation />);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));

    // Zweites Montieren (z.B. weiterer Org-Wechsel): kein Sprung zurueck.
    unmount();
    render(<PushZielNavigation />);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it('ein Ereignis ohne wartendes Ziel loest keine Navigation aus', async () => {
    render(<PushZielNavigation />);
    window.dispatchEvent(new CustomEvent(PUSH_ZIEL_EVENT, { detail: { ziel: '' } }));
    await new Promise((r) => setTimeout(r, 0));
    expect(push).toHaveBeenCalledTimes(0);
  });

  it('nach dem Abbauen wird nicht mehr navigiert', async () => {
    const { unmount } = render(<PushZielNavigation />);
    unmount();
    pushZielMelden('/konfi/badges');
    await new Promise((r) => setTimeout(r, 0));
    expect(push).toHaveBeenCalledTimes(0);
    // Das Ziel bleibt im Merker liegen und wird beim naechsten Montieren
    // eingeloest — nichts geht verloren.
    expect(pushZielAbholen()).toBe('/konfi/badges');
  });
});
