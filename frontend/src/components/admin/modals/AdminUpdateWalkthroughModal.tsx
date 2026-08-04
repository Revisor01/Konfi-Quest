import React from 'react';
import { flagOutline, swapHorizontalOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface AdminUpdateWalkthroughModalProps {
  onClose: () => void;
}

// Kurzvariante des Update-Walkthroughs 2.0 fuer Admins/Org-Admins.
// Gleicher Stil wie die normale Admin-Tour.
const SLIDES: OnboardingSlide[] = [
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Neu: Challenges',
    text: 'Challenges sind Aufgaben, auf die deine Konfis mit eigenen Beiträgen antworten: Foto, Text, Aufnahme oder Link. Bewusst ohne Punkte, ohne Zähler, ohne Rangliste — es gibt nur ein Abzeichen fürs Mitmachen. Du findest sie im Mehr-Tab.',
  },
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Anlegen und moderieren',
    text: 'Beim Anlegen legst du Jahrgänge, Zeitraum, erlaubte Medien, Sichtbarkeit und Freigabe fest. Nach dem Start sind Sichtbarkeit und Freigabe gesperrt — die Zusage an die Konfis bleibt gültig. Offene Beiträge zum Freigeben siehst du direkt an der Challenge.',
  },
  {
    icon: swapHorizontalOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Neu für die Konfis',
    text: 'In der Konfi-Ansicht ist der Anträge-Tab entfallen: Die Anträge liegen jetzt im Events-Tab als eigenes Segment, dafür gibt es den Challenges-Tab. Deine eigenen Tabs bleiben unverändert.',
  },
];

const AdminUpdateWalkthroughModal: React.FC<AdminUpdateWalkthroughModalProps> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default AdminUpdateWalkthroughModal;
