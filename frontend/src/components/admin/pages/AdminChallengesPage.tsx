import React from 'react';
import { useApp } from '../../../contexts/AppContext';
import ChallengesPage from '../../shared/ChallengesPage';
import { leitungChallengeListe } from '../../../utils/challengeListen';

// Befund N7 (27.08.2026): Der Inhalt dieser Seite lag Zeile für Zeile auch in
// TeamerChallengesPage. Er steht jetzt einmal in shared/ChallengesPage; hier
// bleibt nur die rollenspezifische Belegung. Die Datei selbst bleibt bestehen,
// damit Route und Importpfad unverändert sind.
const AdminChallengesPage: React.FC = () => {
  const { user } = useApp();

  return (
    <ChallengesPage
      cacheKey={leitungChallengeListe(user)}
      modalPageId="admin-challenges"
      listenPfad="/admin/challenges"
    />
  );
};

export default AdminChallengesPage;
