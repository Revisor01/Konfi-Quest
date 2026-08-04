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
    text: 'Challenges sind Impulse für deine Gruppe: Die Konfis antworten mit Foto, Text, Aufnahme oder Link. Es gibt keine Punkte und keine Rangliste — nur ein Abzeichen fürs Mitmachen. Den Einstieg findest du auf deiner Startseite.',
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
    title: 'Neu für die Konfis',
    text: 'Für die Konfis hat sich die Navigation geändert: Ihre Anträge liegen jetzt im Events-Tab als eigenes Segment, dafür gibt es den Challenges-Tab. Bei deinen eigenen Tabs bleibt alles wie gewohnt.',
  },
];

const TeamerUpdateWalkthroughModal: React.FC<TeamerUpdateWalkthroughModalProps> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default TeamerUpdateWalkthroughModal;
