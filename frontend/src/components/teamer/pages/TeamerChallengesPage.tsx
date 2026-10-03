import React from 'react';
import { useApp } from '../../../contexts/AppContext';
import ChallengesPage from '../../shared/ChallengesPage';
import { leitungChallengeListe } from '../../../utils/challengeListen';

// Befund N7 (27.08.2026): Diese Seite war eine Zeilenkopie von
// AdminChallengesPage. Der Inhalt steht jetzt einmal in
// shared/ChallengesPage; hier bleibt nur die rollenspezifische Belegung.
//
// Der Zwischenspeicher hängt bewusst zusätzlich an der Person (Schluessel in
// utils/challengeListen.ts): Das Backend filtert die Teamer-Sicht nach
// zugewiesenen Jahrgängen, zwei Teamer:innen derselben Organisation sehen
// also NICHT dasselbe.
//
// Teamer:innen nutzen dieselbe View und dieselbe Challenge-Seite wie die
// Leitung — was sie sehen und dürfen, entscheidet das Backend.
const TeamerChallengesPage: React.FC = () => {
  const { user } = useApp();

  return (
    <ChallengesPage
      cacheKey={leitungChallengeListe(user)}
      modalPageId="teamer-challenges"
      listenPfad="/teamer/challenges"
    />
  );
};

export default TeamerChallengesPage;
