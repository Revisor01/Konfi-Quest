import { useRef, useState } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import ChallengeManageModal from '../components/admin/modals/ChallengeManageModal';
import type { AdminChallenge } from '../types/challenges';

interface ChallengeFormularOptionen {
  /** Element fuer die Karten-Optik des Formulars, zum Zeitpunkt des Oeffnens gelesen. */
  presentingElement: () => HTMLElement | undefined;
  /** Nach erfolgreichem Speichern (das Formular ist dann schon zu). */
  onGespeichert: () => void;
}

/**
 * Das Formular zum Anlegen und Bearbeiten einer Challenge.
 *
 * Seit 2.4.0 von zwei Seiten aus erreichbar: der Liste (Plus oben, Wisch
 * "Bearbeiten") und der Seite einer Challenge (Stift in der Leiste, vorher
 * im Dialog). Die Rueckfrage bei ungespeicherten Aenderungen steht deshalb
 * hier und nicht zweimal -- eine Abschrift liefe beim naechsten Umbau
 * auseinander.
 */
export function useChallengeFormular({ presentingElement, onGespeichert }: ChallengeFormularOptionen) {
  const [presentAlert] = useIonAlert();

  // WICHTIG: Beim Schliessen wird die Challenge NICHT auf null gesetzt.
  // useIonModal rendert das Formular während der Dismiss-Animation weiter —
  // ein null-Render liefe dort in die ErrorBoundary (clearAuth => "Rauswurf
  // zur Anmeldung"). Der Stand wird beim nächsten Oeffnen ohnehin neu gesetzt.
  const [challenge, setChallenge] = useState<AdminChallenge | null>(null);

  // "Ungespeicherte Änderungen"-Stand des Formulars, damit canDismiss auch
  // Swipe-/Backdrop-Schliessen abfangen kann.
  const manageDirtyRef = useRef(false);

  const [presentManageModal, dismissManageModal] = useIonModal(ChallengeManageModal, {
    challenge,
    onDirtyChange: (dirty: boolean) => { manageDirtyRef.current = dirty; },
    onClose: () => { dismissManageModal(); },
    onSuccess: () => {
      dismissManageModal();
      onGespeichert();
    }
  });

  const manageCanDismiss = async (): Promise<boolean> => {
    if (!manageDirtyRef.current) return true;
    return new Promise<boolean>((resolve) => {
      let decided = false;
      const decide = (v: boolean) => { decided = true; resolve(v); };
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        backdropDismiss: false,
        buttons: [
          { text: 'Abbrechen', role: 'cancel', handler: () => decide(false) },
          { text: 'Verwerfen', role: 'destructive', handler: () => decide(true) }
        ],
        onDidDismiss: () => { if (!decided) resolve(false); }
      });
    });
  };

  const oeffnen = (zuBearbeiten: AdminChallenge | null) => {
    setChallenge(zuBearbeiten);
    presentManageModal({
      presentingElement: presentingElement(),
      canDismiss: manageCanDismiss,
      backdropDismiss: false
    });
  };

  return {
    /** Leeres Formular fuer eine neue Challenge. */
    anlegen: () => oeffnen(null),
    /** Formular mit dieser Challenge. */
    bearbeiten: (zuBearbeiten: AdminChallenge) => oeffnen(zuBearbeiten),
  };
}
