import { createElement, useRef, useState, type ReactElement } from 'react';
import { useIonAlert, useIonModal } from '@ionic/react';
import ChallengeManageModal from '../components/admin/modals/ChallengeManageModal';
import WebChallengeDialog from '../components/shared/web/challenges/WebChallengeDialog';
import { useBreitesLayout } from '../navigation/breitesLayout';
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
 *
 * Im breiten Layout des Browsers (ab 992 px) oeffnet sich statt des Modals
 * der Dialog der Web-Fassung (WebChallengeDialog; Simon, 15.10.2026: jedes
 * Formular, das im Browser noch ein Modal der App oeffnet, bekommt ein
 * kompaktes Web-Fenster). Er fragt bei ungespeicherten Aenderungen selbst
 * nach; die Seite stellt ihn mit `fenster` dazu. Beide lesen dieselbe Logik
 * (admin/modals/useChallengeManageFormular).
 */
export function useChallengeFormular({ presentingElement, onGespeichert }: ChallengeFormularOptionen) {
  const [presentAlert] = useIonAlert();
  const breit = useBreitesLayout();

  // WICHTIG: Beim Schliessen wird die Challenge NICHT auf null gesetzt.
  // useIonModal rendert das Formular während der Dismiss-Animation weiter —
  // ein null-Render liefe dort in die ErrorBoundary (clearAuth => "Rauswurf
  // zur Anmeldung"). Der Stand wird beim nächsten Oeffnen ohnehin neu gesetzt.
  const [challenge, setChallenge] = useState<AdminChallenge | null>(null);

  // Der Dialog der Web-Fassung: offen mit dieser Challenge (null = neu) oder zu.
  const [webFormular, setWebFormular] = useState<{ challenge: AdminChallenge | null } | null>(null);

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
    if (breit) {
      setWebFormular({ challenge: zuBearbeiten });
      return;
    }
    setChallenge(zuBearbeiten);
    presentManageModal({
      presentingElement: presentingElement(),
      canDismiss: manageCanDismiss,
      backdropDismiss: false
    });
  };

  // Nach dem Speichern wie nach dem Modal: Fenster zu, dann onGespeichert.
  const fenster: ReactElement | null = webFormular
    ? createElement(WebChallengeDialog, {
      // Je Challenge ein frisches Formular (wie das Modal je Oeffnen).
      key: webFormular.challenge?.id ?? 'neu',
      challenge: webFormular.challenge,
      onSchliessen: () => setWebFormular(null),
      onGespeichert: () => {
        setWebFormular(null);
        onGespeichert();
      },
    })
    : null;

  return {
    /** Leeres Formular fuer eine neue Challenge. */
    anlegen: () => oeffnen(null),
    /** Formular mit dieser Challenge. */
    bearbeiten: (zuBearbeiten: AdminChallenge) => oeffnen(zuBearbeiten),
    /** Der Dialog der Web-Fassung, solange er offen ist -- die Seite stellt ihn dazu. */
    fenster,
  };
}
