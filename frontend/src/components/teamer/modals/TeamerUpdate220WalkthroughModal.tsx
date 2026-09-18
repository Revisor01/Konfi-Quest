import React from 'react';
import {
  ICON_ABZEICHEN,
  ICON_ANWESEND,
  ICON_FINGERABDRUCK,
  ICON_GRUPPE_GEFUELLT,
  ICON_TACHO,
  ICON_TERMIN_GEFUELLT,
} from '../../shared/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Aenderungsanzeige 2.2.0 fuer das TEAM.
//
// ALLES SEIT 2.0 (Simon, 18.09.2026) -- siehe Kommentar in der Konfi-Fassung.
//
// KURZ HALTEN: "Die Leute sind faul zu lesen." Jede Folie unter 300 Zeichen.
//
// WAS DAS TEAM SEIT 16.09.2026 NICHT MEHR DARF, steht hier bewusst DRIN:
// Terminverwaltung ist Leitungssache geworden. Wer das nicht erfaehrt, sucht
// den verschwundenen Knopf und haelt es fuer einen Fehler.
//
// SLIDES exportiert fuer den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: ICON_GRUPPE_GEFUELLT,
    color: 'var(--app-color-teamer)',
    rgb: '--app-color-teamer-rgb',
    title: 'Ihr seht, wer kommt',
    text: 'Am Termin steht jetzt die Teilnehmerliste: Konfis und Team getrennt, mit Jahrgang und Stand der Anmeldung. Termine anlegen, absagen und verbuchen macht die Leitung — eure eigene Zu- und Absage und der QR-Code bleiben.',
  },
  {
    icon: ICON_ANWESEND,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Abgemeldet statt abwesend',
    text: 'Die Leitung kann jemanden abmelden, etwa nach dem Anruf der Eltern. In eurer Teilnehmerliste steht dann "Abgemeldet" statt abwesend — der Unterschied zwischen krank gemeldet und einfach nicht da.',
  },
  {
    icon: ICON_TERMIN_GEFUELLT,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Klarheit bei Absagen',
    text: 'Fällt ein Termin aus, steht der Grund dabei — in der Liste und auf der Startseite. Findet er doch statt, seht ihr das ebenso. Eure eigene Zu- und Absage wirkt jetzt sofort, ohne Neuladen.',
  },
  {
    icon: ICON_FINGERABDRUCK,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Die App abschließen',
    text: 'Die App lässt sich mit Face ID, Touch ID oder Fingerabdruck sperren. Im Profil wählst du, nach welcher Zeit die Abfrage kommt. Angemeldet bleibst du dabei, und von Haus aus ist die Sperre aus.',
  },
  {
    icon: ICON_ABZEICHEN,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Stempel, Rückblick, Tempo',
    text: 'Im Challenges-Tab stehen jetzt auch eure eigenen Stempel — und grau daneben die, die es noch zu holen gibt. Den Jahresrückblick gibt es auch fürs Team. Und die App startet schneller.',
  },
];

const TeamerUpdate220WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default TeamerUpdate220WalkthroughModal;
