import React from 'react';
import {
  ICON_ABZEICHEN,
  ICON_FINGERABDRUCK,
  ICON_FUNKELN,
  ICON_TACHO,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Aenderungsanzeige 2.2.0 fuer KONFIS.
//
// ALLES SEIT 2.0, NICHT NUR SEIT 2.1.1 (Simon, 18.09.2026): Auf dem einen
// System ist 2.1.1 erschienen, auf dem anderen nicht -- dort steht noch 2.0.
// Wer die Anzeige nur mit den 2.2.0-Punkten fuellt, laesst die halbe Haelfte
// aus. Deshalb decken alle drei Fassungen 2.0 bis 2.2 ab.
//
// KURZ HALTEN (Simon, 18.09.2026): "Die Leute sind faul zu lesen." Vier
// Folien, jede unter 300 Zeichen -- der Test haelt die Grenze fest. Wer mehr
// wissen will, findet es im Handbuch; eine Anzeige, die man wegtippt, hat
// gar nichts gesagt.
//
// SLIDES exportiert fuer den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: ICON_TERMIN_GEFUELLT,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Klarheit bei Terminen',
    text: 'Fällt ein Termin aus, steht jetzt dabei, warum. Findet er doch statt, bekommst du Bescheid und stehst wieder da, wo du vorher standst. Abgesagte Termine stehen an ihrem Datum, durchgestrichen.',
  },
  {
    icon: ICON_ABZEICHEN,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Deine Stempel',
    text: 'Unter Challenges stehen jetzt deine Stempel. Tippst du einen an, siehst du, wofür es ihn gab. Was du noch holen kannst, steht grau daneben.',
  },
  {
    icon: ICON_FINGERABDRUCK,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Die App abschließen',
    text: 'Du kannst die App mit Face ID, Touch ID oder deinem Fingerabdruck sperren. Im Profil stellst du ein, nach welcher Zeit gefragt wird. Angemeldet bleibst du dabei, und von Haus aus ist die Sperre aus.',
  },
  {
    icon: ICON_TACHO,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Schneller und sparsamer',
    text: 'Die App startet schneller. Dateien aus dem Chat lädst du nur noch einmal — beim zweiten Antippen sind sie sofort da, auch ohne Netz. Abzeichen mit Emoji zeigen im Rückblick jetzt dieses Emoji.',
  },
  {
    icon: ICON_FUNKELN,
    color: 'var(--app-color-wrapped)',
    rgb: '--app-color-wrapped-rgb',
    title: 'Dein Jahresrückblick',
    text: 'Der Rückblick erzählt eine Geschichte statt einer Liste: eigene Seiten für deine Schwerpunkte und für besondere Zeiten im Kirchenjahr. Ein Jahrgang kann jetzt mehrere Rückblicke haben.',
  },
];

const KonfiUpdate220WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default KonfiUpdate220WalkthroughModal;
