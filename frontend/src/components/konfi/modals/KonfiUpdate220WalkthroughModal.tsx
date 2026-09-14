import React from 'react';
import { ICON_ABZEICHEN, ICON_FINGERABDRUCK, ICON_FUNKELN, ICON_TACHO } from '../../shared/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Aenderungsanzeige 2.2.0 fuer KONFIS.
//
// Auswahl aus dem CHANGELOG-Abschnitt 2.2.0: Genannt wird nur, was eine Konfi
// in der App auch merkt. Die Arbeit der Leitung (Anwesenheit "Abgemeldet",
// Jahrgangsgrenzen, Symbolauswahl fuer Abzeichen) steht in der Fassung der
// Leitung, Interna (Messung, Migrationen, Testumgebung) nirgends -- ein
// Hinweis, der alles aufzaehlt, wird nicht gelesen.
//
// SLIDES exportiert fuer den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: ICON_ABZEICHEN,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Deine Stempel im Profil',
    text: 'Hinter deinen Abzeichen stehen jetzt auch die Challenge-Stempel, die du gesammelt hast. Wer noch keinen hat, sieht den Abschnitt gar nicht — er kommt mit dem ersten Stempel von allein dazu.',
  },
  {
    icon: ICON_FINGERABDRUCK,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Die App abschließen',
    text: 'Du kannst die App mit Face ID, Touch ID oder deinem Fingerabdruck sperren. In deinem Profil stellst du ein, nach welcher Zeit im Hintergrund gefragt wird: sofort, nach 1, 5 oder 15 Minuten. Praktisch, wenn du dein Handy mal aus der Hand gibst — angemeldet bleibst du dabei. Die Sperre ist von Haus aus aus.',
  },
  {
    icon: ICON_TACHO,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Schneller und sparsamer',
    text: 'Die App startet spürbar schneller. Und Dateien aus dem Chat — ein PDF, ein Dokument, eine Tonaufnahme — lädst du nur noch einmal: Beim zweiten Antippen sind sie sofort da, auch ohne Netz.',
  },
  {
    icon: ICON_FUNKELN,
    color: 'var(--app-color-wrapped)',
    rgb: '--app-color-wrapped-rgb',
    title: 'Abzeichen mit Emoji',
    text: 'Abzeichen, für die ein Emoji gewählt wurde, zeigen im Rückblick endlich dieses Emoji statt einer Trophäe für alle.',
  },
];

const KonfiUpdate220WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default KonfiUpdate220WalkthroughModal;
