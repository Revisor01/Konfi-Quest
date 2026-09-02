import React from 'react';
import { sparklesOutline, imagesOutline, linkOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
  displayName?: string;
}

// Update-Walkthrough 2.1.1 für BESTANDS-Konfis.
//
// Auswahl aus 73 CHANGELOG-Einträgen seit 2.1.0: Genannt wird nur, was eine
// Konfi in der App auch merkt. Rollen-Härtungen, Testkram und die Arbeit der
// Leitung gehören nicht hierher -- ein Hinweis, der alles aufzählt, wird
// nicht gelesen.
//
// SLIDES exportiert für den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: sparklesOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Dein Jahresrückblick ist persönlich',
    text: 'Gleich nach der Begrüßung kommt eine Seite, die zeigt, was dich in diesem Jahr besonders macht — ob du den Chat am Leben hältst, viele Reaktionen bekommst oder bei allem dabei warst. Verglichen wird nur mit dem Durchschnitt deines Jahrgangs, ohne Namen und nur, wenn der Vergleich freundlich ausfällt.',
  },
  {
    icon: imagesOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Deine Fotos, größer',
    text: 'Deine Beiträge aus den Challenges erscheinen im Rückblick jetzt groß statt als Briefmarke. Hast du nur ein oder zwei, füllen sie die ganze Seite. Am Ende steht: „Dein Weg. Deine Zeit. Dein Glaube."',
  },
  {
    icon: linkOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Material mit Links',
    text: 'Wenn dein Team Material teilt, kann jetzt beides zusammen dabei sein: eine Datei zum Herunterladen und Links, zum Beispiel zu einem Video. Und wo ein Termin Material hat, kommst du direkt aus dem Termin dorthin.',
  },
];

const KonfiUpdate211WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default KonfiUpdate211WalkthroughModal;
