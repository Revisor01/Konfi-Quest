import React, { useState, useCallback } from 'react';
import { useIonModal } from '@ionic/react';
import { useApp } from '../../contexts/AppContext';
import { useLiveRefresh } from '../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../services/offlineCache';
import api from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import ChallengesView from '../konfi/views/ChallengesView';
import ChallengeSubmitModal from '../konfi/modals/ChallengeSubmitModal';
import ChallengeDetailModal from '../konfi/modals/ChallengeDetailModal';
import type { KonfiChallenge, KonfiChallengesResponse } from '../../types/challenges';

// Teilnehmer-Sicht auf Challenges — identisch fuer Konfis UND fuer das Team
// (Migration 121: audience 'konfis_und_team' / 'nur_team'). Bewusst dieselbe
// View und dieselben Modals wie die Konfi-Seite, damit "mitmachen" fuer alle
// gleich aussieht und gleichgewichtet ist (User-Entscheid 08.08.2026):
// Pastor:innen und Teamer:innen sollen beitragen koennen, nicht nur zuschauen.
//
// Das Backend entscheidet ueber GET /challenges/konfi, welche Challenges eine
// Rolle sieht — hier gibt es KEINE rollenabhaengige Logik.

interface ChallengeParticipationPanelProps {
  /**
   * Element fuer die Card-Modal-Optik (Sheet ueber der Seite). Die aufrufende
   * Seite gibt ihr pageRef/presentingElement durch.
   */
  presentingElement?: HTMLElement | null;
  /** Cache-Schluessel-Praefix, damit Rollen sich keinen Cache teilen. */
  cacheKeyPrefix: string;
  /** Inhalt direkt unter dem SectionHeader (Verwalten|Mitmachen der Page). */
  headerSlot?: React.ReactNode;
}

const EMPTY_RESPONSE: KonfiChallengesResponse = { active: [], archive: [], marks: [] };

const ChallengeParticipationPanel: React.FC<ChallengeParticipationPanelProps> = ({
  presentingElement,
  cacheKeyPrefix,
  headerSlot
}) => {
  const { user } = useApp();

  const { data, loading, refresh } = useOfflineQuery<KonfiChallengesResponse>(
    `${cacheKeyPrefix}:${user?.id}`,
    () => api.get('/challenges/konfi').then((r) => r.data),
    { ttl: CACHE_TTL.REQUESTS }
  );

  // Defensive: bei kaputten/alten Cache-Eintraegen auf leere Listen fallen.
  const response = data && typeof data === 'object' ? data : EMPTY_RESPONSE;
  const active = Array.isArray(response.active) ? response.active : [];
  const archive = Array.isArray(response.archive) ? response.archive : [];
  const marks = Array.isArray(response.marks) ? response.marks : [];

  const [selectedChallenge, setSelectedChallenge] = useState<KonfiChallenge | null>(null);

  const [presentSubmitModal, dismissSubmitModal] = useIonModal(ChallengeSubmitModal, {
    challenge: selectedChallenge,
    // selectedChallenge wird beim Schliessen bewusst NICHT zurueckgesetzt: das
    // Modal ist waehrend der Dismiss-Animation noch gemountet (ein null-Render
    // liefe in die ErrorBoundary bzw. blitzte den Ladezustand auf).
    onClose: () => dismissSubmitModal(),
    onSuccess: () => {
      dismissSubmitModal();
      refresh();
    }
  });

  const [presentDetailModal, dismissDetailModal] = useIonModal(ChallengeDetailModal, {
    challenge: selectedChallenge,
    onClose: () => dismissDetailModal(),
    onChanged: () => refresh(),
    onSubmit: (challenge: KonfiChallenge) => {
      dismissDetailModal();
      setSelectedChallenge(challenge);
      setTimeout(() => {
        presentSubmitModal({ presentingElement: presentingElement || undefined });
      }, 300);
    }
  });

  useLiveRefresh('challenges', refresh);

  const handleSelectChallenge = useCallback((challenge: KonfiChallenge) => {
    setSelectedChallenge(challenge);
    presentDetailModal({ presentingElement: presentingElement || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentDetailModal, presentingElement]);

  const handleSubmitChallenge = useCallback((challenge: KonfiChallenge) => {
    setSelectedChallenge(challenge);
    presentSubmitModal({ presentingElement: presentingElement || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentSubmitModal, presentingElement]);

  if (loading && !data) {
    return <LoadingSpinner message="Challenges werden geladen..." />;
  }

  return (
    <ChallengesView
      active={active}
      archive={archive}
      marks={marks}
      onSelectChallenge={handleSelectChallenge}
      onSubmit={handleSubmitChallenge}
      headerSlot={headerSlot}
    />
  );
};

export default ChallengeParticipationPanel;
