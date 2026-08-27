import React from 'react';
import { useApp } from '../../../contexts/AppContext';
import ChallengesPage from '../../shared/ChallengesPage';

// Befund N7 (27.08.2026): Der Inhalt dieser Seite lag Zeile für Zeile auch in
// TeamerChallengesPage. Er steht jetzt einmal in shared/ChallengesPage; hier
// bleibt nur die rollenspezifische Belegung. Die Datei selbst bleibt bestehen,
// damit Route und Importpfad unverändert sind.
const AdminChallengesPage: React.FC = () => {
  const { user } = useApp();

  return (
    <ChallengesPage
      cacheKey={'admin:challenges:' + user?.organization_id}
      modalPageId="admin-challenges"
    />
  );
};

export default AdminChallengesPage;
