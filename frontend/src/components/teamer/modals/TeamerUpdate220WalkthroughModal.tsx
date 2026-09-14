import React from 'react';
import {
  ICON_ABZEICHEN,
  ICON_ANWESEND,
  ICON_FINGERABDRUCK,
  ICON_TACHO,
} from '../../shared/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Aenderungsanzeige 2.2.0 fuer TEAMER:INNEN.
//
// Der wichtigste Punkt steht vorn: Die Anwesenheit kennt einen dritten
// Eintrag und eine Notiz — das aendert die taegliche Arbeit am Termin. Was
// nur die Leitung anlegt (Symbolauswahl fuer Abzeichen), steht in der Fassung
// der Leitung.
//
// SLIDES exportiert fuer den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: ICON_ANWESEND,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Abgemeldet und Notizen',
    text: 'Neben anwesend und abwesend gibt es jetzt "Abgemeldet" — für den Anruf der Eltern, wenn jemand krank ist. Grund und Notiz trägst du in einem eigenen Fenster ein, der Grund steht danach in der Teilnehmerliste. Punkte gibt es dabei keine, schon vergebene werden zurückgenommen. Eine Notiz wie "ging um 14 Uhr" geht auch zu einer normalen Anwesenheit, ohne dass sich am Status etwas ändert.',
  },
  {
    icon: ICON_ANWESEND,
    color: 'var(--app-color-teamer)',
    rgb: '--app-color-teamer-rgb',
    title: 'Wer hat das eingetragen',
    text: 'Unter jedem Eintrag steht klein, wer die Anwesenheit zuletzt eingetragen hat und wann — bei einer Rückfrage ist damit klar, wen man fragt. Beim Check-in per QR-Code fehlt die Zeile: dort war niemand aus dem Team.',
  },
  {
    icon: ICON_FINGERABDRUCK,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Die App abschließen',
    text: 'Die App lässt sich mit Face ID, Touch ID oder Fingerabdruck sperren. In deinem Profil wählst du, nach welcher Zeit im Hintergrund die Abfrage kommt: sofort, nach 1, 5 oder 15 Minuten. Praktisch, wenn das Handy einmal aus der Hand geht — angemeldet bleibst du dabei. Die Sperre ist von Haus aus aus.',
  },
  {
    icon: ICON_ABZEICHEN,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Stempel im Profil',
    text: 'Hinter den Abzeichen stehen jetzt auch die Challenge-Stempel — bei dir selbst und bei den Konfis, die du ansiehst. Wer noch keinen hat, sieht den Abschnitt nicht.',
  },
  {
    icon: ICON_TACHO,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Schneller und sparsamer',
    text: 'Die App startet spürbar schneller. Dateien aus dem Chat werden nur noch einmal geladen: Beim zweiten Antippen liegt das PDF sofort vor dir, auch ohne Netz. Und große Anhänge brechen im Gemeindehaus nicht mehr ab, wenn die Verbindung langsam ist.',
  },
];

const TeamerUpdate220WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default TeamerUpdate220WalkthroughModal;
