import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import React, { useEffect, useState } from 'react';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import {
  IonApp, IonHeader, IonToolbar, IonTitle, IonContent, IonPage, IonModal,
  useIonModal, setupIonicReact,
} from '@ionic/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-16, Nebenbefund -- gerenderte Gegenprobe zur
// Zaehlung (modaleUeberHookBenannt.test.ts): Mit echtem @ionic/react wird ein
// Modal ueber useIonModal geoeffnet, genau wie es die Seiten tun. Geprueft
// wird die Dialog-Huelle im Shadow-DOM von ion-modal -- das Element mit
// role="dialog", dessen Namen die Vorlesehilfe beim Oeffnen ansagt. Vorher:
// kein Name (Chromium-Zugaenglichkeitsbaum: ""), die Vorlesehilfe sagte nur
// „Dialog".
// ---------------------------------------------------------------------------

vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn().mockResolvedValue({ data: {} }) },
}));
vi.mock('../../services/tokenStore', () => ({
  setToken: vi.fn(), setRefreshToken: vi.fn(), getDeviceId: vi.fn().mockResolvedValue('geraet'),
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, type: 'konfi' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));

import ChangePasswordModal from '../../components/shared/ChangePasswordModal';
import FileViewerModal from '../../components/shared/FileViewerModal';
import { modalNamenAnschalten, dialogHuelle } from '../../utils/modalNamen';

setupIonicReact({ animated: false });

// Wartezeit fuer das Oeffnen: Ionic laedt beim ersten Modal der Datei seine
// Bausteine, und unter der vollen Suite (parallele Worker) dauerte das
// gemessen laenger als die 1 s, die waitFor voreinstellt -- das Modal stand
// noch auf overlay-hidden, ionModalWillPresent war noch nicht gefallen.
const OEFFNEN = { timeout: 8000 };

let abschalten: () => void = () => {};
beforeAll(() => { abschalten = modalNamenAnschalten(); });
afterAll(() => abschalten());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// Ein Rahmen wie eine Seite der App: useIonModal mit Komponente und Props,
// geoeffnet ueber present() -- optional mit htmlAttributes.
function oeffne<P extends object>(
  Komponente: React.ComponentType<P>,
  props: P,
  optionen: Record<string, unknown> = {},
) {
  let present: ((o: Record<string, unknown>) => void) | null = null;
  const Rahmen: React.FC = () => {
    const [p] = useIonModal(Komponente as React.ComponentType<object>, props);
    present = p as (o: Record<string, unknown>) => void;
    return null;
  };
  render(<IonApp><Rahmen /></IonApp>);
  act(() => { present!(optionen); });
}

const huelle = async (): Promise<HTMLElement> => {
  let h: HTMLElement | null = null;
  await waitFor(() => {
    const modal = document.querySelector('ion-modal');
    h = modal ? dialogHuelle(modal) : null;
    expect(h).not.toBeNull();
  }, OEFFNEN);
  return h!;
};

describe('Per useIonModal geoeffnete Modale tragen ihren Titel als Namen (UI BF-16, Nebenbefund)', { timeout: 20000 }, () => {
  it('„Passwort ändern" (Profil aller drei Rollen): die Dialog-Huelle heisst wie der Titel', async () => {
    oeffne(ChangePasswordModal, { onClose: () => {}, onSuccess: () => {}, variante: 'purple' as const });
    const h = await huelle();
    expect(h.getAttribute('role')).toBe('dialog');
    await waitFor(() => expect(h.getAttribute('aria-label')).toBe('Passwort ändern'), OEFFNEN);
  });

  it('Datei-Ansicht (Material, Chat-Anhang) ohne Kopfzeile: der Dateiname ist der Name', async () => {
    oeffne(FileViewerModal, {
      files: [{ url: 'blob:gemeindebrief', fileName: 'Gemeindebrief-Oktober.pdf', mimeType: 'application/pdf' }],
      onClose: () => {},
    });
    const h = await huelle();
    await waitFor(() => expect(h.getAttribute('aria-label')).toBe('Gemeindebrief-Oktober.pdf'), OEFFNEN);
  });

  it('der Name folgt dem Titel, wenn er wechselt („Aktivität laden..." -> „Aktivität prüfen")', async () => {
    let laden: (fertig: boolean) => void = () => {};
    const Wechselnd: React.FC = () => {
      const [fertig, setFertig] = useState(false);
      useEffect(() => { laden = setFertig; }, []);
      return (
        <IonPage>
          <IonHeader><IonToolbar><IonTitle>{fertig ? 'Aktivität prüfen' : 'Aktivität laden...'}</IonTitle></IonToolbar></IonHeader>
          <IonContent />
        </IonPage>
      );
    };
    oeffne(Wechselnd, {});
    const h = await huelle();
    await waitFor(() => expect(h.getAttribute('aria-label')).toBe('Aktivität laden...'), OEFFNEN);
    act(() => laden(true));
    await waitFor(() => expect(h.getAttribute('aria-label')).toBe('Aktivität prüfen'), OEFFNEN);
  });

  it('ein ausdruecklicher Name (aria-label ueber htmlAttributes) hat Vorrang vor dem Titel', async () => {
    const MitTitel: React.FC = () => (
      <IonPage><IonHeader><IonToolbar><IonTitle>Titel</IonTitle></IonToolbar></IonHeader><IonContent /></IonPage>
    );
    oeffne(MitTitel, {}, { htmlAttributes: { 'aria-label': 'Ausdrücklich' } });
    const h = await huelle();
    // Warten, bis der Inhalt samt Titel steht -- erst dann koennte der
    // Beobachter ueberschreiben.
    await waitFor(() => expect(document.querySelector('ion-modal ion-title')?.textContent).toBe('Titel'), OEFFNEN);
    await new Promise((r) => setTimeout(r, 50));
    expect(h.getAttribute('aria-label')).toBe('Ausdrücklich');
  });

  it('auch <IonModal aria-labelledby> (Postfach, „Neuer Rückblick") bekommt den Namen -- der Verweis allein erreicht die Huelle nicht', async () => {
    render(
      <IonApp>
        <IonModal isOpen aria-labelledby="probe-titel">
          <IonHeader><IonToolbar><IonTitle id="probe-titel">Postfach</IonTitle></IonToolbar></IonHeader>
          <IonContent />
        </IonModal>
      </IonApp>,
    );
    const h = await huelle();
    // Ionic reicht nur aria-label und role an die Huelle weiter; aria-labelledby
    // bleibt am Host (ion-modal.js, inheritAttributes).
    expect(h.getAttribute('aria-labelledby')).toBeNull();
    await waitFor(() => expect(h.getAttribute('aria-label')).toBe('Postfach'), OEFFNEN);
  });
});
