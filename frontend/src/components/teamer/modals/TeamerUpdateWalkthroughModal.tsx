import React from 'react';
import { flagOutline, swapHorizontalOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface TeamerUpdateWalkthroughModalProps {
  onClose: () => void;
}

// Kurzvariante des Update-Walkthroughs 2.0 fuer Teamer:innen — was neu ist und
// wo es liegt. Gleicher Stil wie die normale Teamer-Tour.
const SLIDES: OnboardingSlide[] = [
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Neu: Challenges',
    text: 'Challenges sind Impulse für deine Gruppe: Die Konfis antworten mit Foto, Text, Aufnahme oder Link. Es gibt keine Punkte und keine Rangliste — nur ein Abzeichen fürs Mitmachen. Sie haben einen eigenen Tab in deiner Tab-Leiste.',
  },
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Anlegen und begleiten',
    text: 'Du legst Challenges für deine Jahrgänge an und gibst die Beiträge frei, wenn du das beim Anlegen so festgelegt hast. Achtung: Sichtbarkeit und Freigabe stehen nach dem Start fest — darauf sollen sich die Konfis verlassen können.',
  },
  {
    icon: swapHorizontalOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Auch deine Tabs sind neu',
    text: 'Deine Tab-Leiste ist jetzt Start · Chat · Events · Challenges · Badges. Den Aktivitäten-Tab gibt es nicht mehr: Deine Anträge liegen jetzt oben im Events-Tab als eigenes Segment. Bei den Konfis ist es genauso — dafür haben sie den Challenges-Tab.',
  },
];

const TeamerUpdateWalkthroughModal: React.FC<TeamerUpdateWalkthroughModalProps> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default TeamerUpdateWalkthroughModal;
