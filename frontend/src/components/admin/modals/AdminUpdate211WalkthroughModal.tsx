import React from 'react';
import { checkmarkCircleOutline, linkOutline, shieldCheckmarkOutline, sparklesOutline, flagOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface Props {
  onClose: () => void;
}

// Update-Walkthrough 2.1.1 für die Leitung.
//
// Die Leitung bekommt eine Folie mehr als die anderen Rollen: Die
// Rollen- und Jahrgangs-Regel ändert, was sie sieht und darf. Wer das nicht
// erfährt, hält eine leere Liste für einen Fehler statt für eine Grenze.
//
// SLIDES exportiert für den Textbaustein-Test (onboardingSlides.test.ts).
export const SLIDES: OnboardingSlide[] = [
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Was Challenges sind',
    text: 'Challenges begleiten deine Konfis über einen Zeitraum, den du festlegst: Fotos, Texte, Aufnahmen oder Links. Bewusst ohne Punkte, ohne Zähler, ohne Rangliste — es gibt nur einen Stempel fürs Mitmachen. Die Idee: Die Konfis beschäftigen sich eine Zeit lang mit einem Thema, mitten in ihrem Alltag. Beim Anlegen bestimmst du Jahrgänge, Zeitraum, erlaubte Medien, Sichtbarkeit und Freigabe; nach dem Start bleiben Sichtbarkeit und Freigabe gesperrt.',
  },
  {
    icon: checkmarkCircleOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Wer kommt, wer nicht',
    text: 'Teamer:innen sagen zu Terminen jetzt ausdrücklich zu oder ab. In der Terminansicht siehst du, wer abgesagt hat und warum — eine Absage nach vorheriger Zusage ist eigens gekennzeichnet, denn dann hast du mit dieser Person schon geplant. Bei einer Absage wird der Platz frei und die Warteliste rückt nach.',
  },
  {
    icon: linkOutline,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Material einfacher',
    text: 'Material trägt Dateien und Links jetzt zusammen — ein PDF und dazu mehrere Videos, ohne Entweder-oder. Den Sichtbarkeits-Schalter gibt es nicht mehr: Wer das Material sieht, entscheidet allein die Jahrgangs-Zuordnung. Mit Jahrgang nur dessen Teamer:innen, ohne Jahrgang alle Teamer:innen der Gemeinde. Bearbeiten darf, wer es angelegt hat.',
  },
  {
    icon: shieldCheckmarkOutline,
    color: 'var(--app-color-jahrgang)',
    rgb: '--app-color-jahrgang-rgb',
    title: 'Rollen und Jahrgänge',
    text: 'Als Admin siehst du jetzt überall nur die Jahrgänge, die dir zugewiesen sind — bei Konfis, Anträgen, Terminen und im Rückblick. Teamer:innen bleiben davon ausgenommen, die erreichst du alle. Bleibt eine Liste leer, steht künftig dabei, dass dir noch kein Jahrgang zugewiesen ist; das ist kein Fehler. Org-Admins dürfen weiterhin alles, und nur sie legen Jahrgänge an.',
  },
  {
    icon: sparklesOutline,
    color: 'var(--app-color-wrapped)',
    rgb: '--app-color-wrapped-rgb',
    title: 'Der Rückblick, persönlicher',
    text: 'Der Jahresrückblick zeigt jeder Konfi zuerst, was sie besonders macht — verglichen mit dem Schnitt ihres Jahrgangs, anonym und nur, wenn der Vergleich freundlich ausfällt. Fotos aus Challenges erscheinen groß. Den Rückblick einer Konfi oder einer Teamer:in kannst du dir in deren Ansicht selbst ansehen.',
  },
];

const AdminUpdate211WalkthroughModal: React.FC<Props> = ({ onClose }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} />
);

export default AdminUpdate211WalkthroughModal;
