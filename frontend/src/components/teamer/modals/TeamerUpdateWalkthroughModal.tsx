import React from 'react';
import { flagOutline, swapHorizontalOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface TeamerUpdateWalkthroughModalProps {
  onClose: () => void;
}

// Kurzvariante des Update-Walkthroughs 2.0 für Teamer:innen — was neu ist und
// wo es liegt. Gleicher Stil wie die normale Teamer-Tour.
const SLIDES: OnboardingSlide[] = [
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Neu: Challenges',
    text: 'Challenges begleiten die Konfis über einen Zeitraum, den du festlegst: Fotos, Texte, Aufnahmen oder Links. Ohne Punkte, ohne Zähler, ohne Rangliste — nur ein Abzeichen fürs Mitmachen. Die Idee: sich eine Zeit lang mit einem Thema beschäftigen, mitten im Alltag. Sie haben einen eigenen Tab in deiner Tab-Leiste.',
  },
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Anlegen, mitmachen, begleiten',
    text: 'Du legst Challenges für deine Jahrgänge an und gibst Beiträge frei, wenn du das so festgelegt hast. Du kannst Beiträge auch nachträglich anonymisieren oder ausblenden. Sichtbarkeit und Freigabe stehen nach dem Start fest — darauf sollen sich die Konfis verlassen können. Und du machst mit: Teamer:innen sind bei Challenges keine Zuschauer, es gibt sogar Runden nur fürs Team.',
  },
  {
    icon: swapHorizontalOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Auch deine Tabs sind neu',
    text: 'Deine Tab-Leiste ist jetzt Start · Chat · Events · Challenges · Badges. Den eigenen Aktivitäten-Tab gibt es nicht mehr: Deine Aktivitäten liegen jetzt oben im Events-Tab als eigenes Segment. Bei den Konfis ist es genauso — dafür haben sie den Challenges-Tab.',
  },
];

const TeamerUpdateWalkthroughModal: React.FC<TeamerUpdateWalkthroughModalProps> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default TeamerUpdateWalkthroughModal;
