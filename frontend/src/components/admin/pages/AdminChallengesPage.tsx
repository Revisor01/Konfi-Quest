import React, { useState, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { add, arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useBadge } from '../../../contexts/BadgeContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { useChallengeDelete } from '../../../hooks/useChallengeDelete';
import { CACHE_TTL } from '../../../services/offlineCache';
import LoadingSpinner from '../../common/LoadingSpinner';
import ChallengesManageView from '../views/ChallengesManageView';
import { ChallengeParticipationPanel } from '../../shared';
import ChallengeManageModal from '../modals/ChallengeManageModal';
import ChallengeModerationModal from '../modals/ChallengeModerationModal';
import { triggerPullHaptic } from '../../../utils/haptics';
import type { AdminChallenge } from '../../../types/challenges';

const AdminChallengesPage: React.FC = () => {
  const { user } = useApp();
  const { refreshAllCounts } = useBadge();
  const { pageRef, presentingElement } = useModalPage('admin-challenges');

  const { data: challenges, loading, refresh: refreshChallenges } = useOfflineQuery<AdminChallenge[]>(
    'admin:challenges:' + user?.organization_id,
    async () => { const res = await api.get('/challenges/admin'); return res.data; },
    { ttl: CACHE_TTL.REQUESTS }
  );

  const [presentAlert] = useIonAlert();
  const [segment, setSegment] = useState<'verwalten' | 'mitmachen'>('verwalten');

  // Aktuell im Modal bearbeitete/moderierte Challenge
  const [editChallenge, setEditChallenge] = useState<AdminChallenge | null>(null);
  const [moderationChallenge, setModerationChallenge] = useState<AdminChallenge | null>(null);

  // "Ungespeicherte Aenderungen"-Stand des Formular-Modals, damit canDismiss
  // auch Swipe-/Backdrop-Schliessen abfangen kann.
  const manageDirtyRef = useRef(false);

  // WICHTIG: Beim Schliessen wird der Challenge-State NICHT auf null gesetzt.
  // useIonModal rendert das Modal waehrend der Dismiss-Animation weiter — ein
  // null-Render liefe dort in die ErrorBoundary (clearAuth => "Rauswurf zur
  // Anmeldung"). Der State wird beim naechsten Oeffnen ohnehin neu gesetzt.
  const [presentManageModal, dismissManageModal] = useIonModal(ChallengeManageModal, {
    challenge: editChallenge,
    onDirtyChange: (dirty: boolean) => { manageDirtyRef.current = dirty; },
    onClose: () => { dismissManageModal(); },
    onSuccess: () => {
      dismissManageModal();
      refreshChallenges();
    }
  });

  const [presentModerationModal, dismissModerationModal] = useIonModal(ChallengeModerationModal, {
    challenge: moderationChallenge,
    onClose: () => { dismissModerationModal(); },
    onChanged: () => {
      refreshChallenges();
      // Tab-Badge (offene Freigaben) direkt nachziehen.
      refreshAllCounts();
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

  useLiveRefresh('challenges', refreshChallenges);

  const openCreate = () => {
    setEditChallenge(null);
    presentManageModal({
      presentingElement: presentingElement,
      canDismiss: manageCanDismiss,
      backdropDismiss: false
    });
  };

  const openEdit = (challenge: AdminChallenge) => {
    setEditChallenge(challenge);
    presentManageModal({
      presentingElement: presentingElement,
      canDismiss: manageCanDismiss,
      backdropDismiss: false
    });
  };

  const openModeration = (challenge: AdminChallenge) => {
    setModerationChallenge(challenge);
    presentModerationModal({ presentingElement: presentingElement });
  };

  const { handleDelete } = useChallengeDelete({ onDeleted: refreshChallenges });

  // Verwalten | Mitmachen — wird als headerSlot DIREKT unter den Stats-Header
  // gereicht (Muster wie Events|Anträge), damit der Switcher nicht ueber dem
  // Header steht und das Design zerreisst (User-Feedback 09.08.).
  const segmentSwitcher = (
    <div className="app-segment-wrapper">
      <IonSegment
        value={segment}
        onIonChange={(e) => setSegment(e.detail.value as 'verwalten' | 'mitmachen')}
      >
        <IonSegmentButton value="verwalten">
          <IonLabel>Verwalten</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="mitmachen">
          <IonLabel>Mitmachen</IonLabel>
        </IonSegmentButton>
      </IonSegment>
    </div>
  );

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton aria-label="Zurück" onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Challenges</IonTitle>
          <IonButtons slot="end">
            {segment === 'verwalten' && (
              <IonButton aria-label="Neue Challenge" onClick={openCreate} title="Neue Challenge">
                <IonIcon icon={add} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Challenges</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => { refreshChallenges(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {segment === 'mitmachen' ? (
          <ChallengeParticipationPanel
            presentingElement={pageRef.current || presentingElement}
            cacheKeyPrefix="admin:challenges:teilnahme"
            headerSlot={segmentSwitcher}
          />
        ) : loading ? (
          <LoadingSpinner message="Challenges werden geladen..." />
        ) : (
          <ChallengesManageView
            challenges={challenges || []}
            onSelectChallenge={openModeration}
            onEditChallenge={openEdit}
            onDeleteChallenge={handleDelete}
            presentingElement={pageRef.current || presentingElement}
            headerSlot={segmentSwitcher}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminChallengesPage;
