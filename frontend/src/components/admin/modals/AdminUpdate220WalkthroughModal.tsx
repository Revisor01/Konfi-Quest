import React from 'react';
import {
  ICON_ABZEICHEN,
  ICON_ANWESEND,
  ICON_FINGERABDRUCK,
  ICON_SCHUTZ,
  ICON_TACHO,
} from '../../shared/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Aenderungsanzeige 2.2.0 fuer die LEITUNG.
//
// Die Leitung bekommt eine Folie mehr als die anderen Rollen: Die
// Jahrgangsgrenzen bei Terminen und Profilen aendern, was sie sieht und darf.
// Wer das nicht erfaehrt, haelt eine leere Liste fuer einen Fehler statt fuer
// eine Grenze -- dieselbe Ueberlegung wie bei 2.1.1.
//
// SLIDES exportiert fuer den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: ICON_ANWESEND,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Abgemeldet und Notizen',
    text: 'Die Anwesenheit kennt einen dritten Eintrag: "Abgemeldet" — für den Anruf der Eltern, wenn jemand krank ist. Grund und Notiz kommen in ein eigenes Fenster, der Grund steht danach in der Teilnehmerliste, damit ihn das ganze Team sieht. Punkte gibt es dabei keine, schon vergebene werden zurückgenommen. In der Matrix zählt ein solcher Termin nicht in die Pflicht-Summe.',
  },
  {
    icon: ICON_ANWESEND,
    color: 'var(--app-color-teamer)',
    rgb: '--app-color-teamer-rgb',
    title: 'Wer hat das eingetragen',
    text: 'Unter jedem Eintrag steht klein, wer die Anwesenheit zuletzt eingetragen hat und wann — bei einer Rückfrage ist damit klar, wen man fragt. Anwesenheit und Notiz werden getrennt geführt. Beim Check-in per QR-Code und bei älteren Einträgen fehlt die Zeile: dort war niemand aus dem Team.',
  },
  {
    icon: ICON_SCHUTZ,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Grenzen bei Terminen und Profilen',
    text: 'Termine legst du nur noch in deinen eigenen Jahrgängen an, änderst und löschst sie dort — auch Serientermine, auch das Eintragen von Personen und die Anwesenheit. Allgemeine und reine Team-Termine bleiben für alle offen. Ebenso die Profile: Wer nur bestimmte Jahrgänge betreut, kommt an die übrigen Konfis nicht mehr heran. Bleibt eine Liste leer, ist das kein Fehler, sondern diese Grenze.',
  },
  {
    icon: ICON_ABZEICHEN,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Mehr Symbole, dazu Stempel',
    text: 'Für Abzeichen, Stempel und Zertifikate stehen 95 Symbole zur Auswahl statt bisher 54 — mehr aus Musik, Sport, Spiel, Essen, Wetter und Unterwegssein. In der Detailansicht stehen unter den Abzeichen jetzt auch die Challenge-Stempel der angesehenen Person, bei Konfis wie bei Teamer:innen.',
  },
  {
    icon: ICON_FINGERABDRUCK,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Sperre, Tempo, Dateien',
    text: 'Die App lässt sich mit Face ID, Touch ID oder Fingerabdruck sperren; im Profil wählst du, nach welcher Zeit im Hintergrund gefragt wird. Angemeldet bleibst du dabei, und die Sperre ist von Haus aus aus. Die App startet außerdem spürbar schneller, und Dateien aus dem Chat werden nur noch einmal geladen — beim zweiten Antippen sind sie sofort da.',
  },
];

const AdminUpdate220WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default AdminUpdate220WalkthroughModal;
