import React from 'react';
import { calendarOutline, checkmarkCircleOutline, swapHorizontalOutline } from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from './OnboardingTour';

interface MitmachenErklaerungModalProps {
  onClose: () => void;
  displayName?: string;
  /** 'konfi' | 'teamer' | 'admin' — steuert die Ansprache im dritten Bild. */
  rolle?: 'konfi' | 'teamer' | 'admin';
}

// Eigener Erklaertext zum Mitmachen-Tab (Events + Aktivitaeten). Bewusst
// getrennt vom Update-Walkthrough: Dieser hier bleibt dauerhaft im Profil
// erreichbar und erklaert EINE Sache gruendlich, waehrend "Was ist neu" die
// Neuerungen der Version streift.
//
// Der Hinweis stand frueher als gruener Kasten IM Mitmachen-Tab und wurde dort
// entfernt (589802b8) — mit dem ausdruecklichen Vermerk, dass er auf der
// Startseite und im Profil zurueckkehrt. Das ist dieser Schritt.
// SLIDES exportiert fuer den Textbaustein-Test.
export const SLIDES_BASIS: OnboardingSlide[] = [
  {
    icon: swapHorizontalOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Alles an einem Ort',
    text: 'Events und Aktivitäten wohnen zusammen im Tab "Mitmachen" — oben schaltest du zwischen beiden Reitern um. Einen eigenen Tab für Anträge gibt es nicht mehr: Aus den Anträgen sind die Aktivitäten geworden.',
  },
  {
    icon: calendarOutline,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Events: vorher anmelden',
    text: 'Unter "Events" stehen die Termine, zu denen du dich anmeldest — Gottesdienste, Konfi-Tage, Fahrten. Du meldest dich vorher an, siehst wie viele Plätze frei sind und kommst bei vollen Terminen auf die Warteliste. Pflichttermine erkennst du an der Markierung.',
  },
];

const SLIDE_AKTIVITAETEN_KONFI: OnboardingSlide = {
  icon: checkmarkCircleOutline,
  color: 'var(--app-color-activities)',
  rgb: '--app-color-activities-rgb',
  title: 'Aktivitäten: hinterher melden',
  text: 'Unter "Aktivitäten" meldest du, was du schon gemacht hast — mit Foto, wenn du magst. Dein Team schaut drauf und bestätigt; erst dann zählen die Punkte. Solange etwas offen ist, siehst du es als "wartet auf Bestätigung".',
};

const SLIDE_AKTIVITAETEN_TEAM: OnboardingSlide = {
  icon: checkmarkCircleOutline,
  color: 'var(--app-color-activities)',
  rgb: '--app-color-activities-rgb',
  title: 'Aktivitäten: bestätigen',
  text: 'Unter "Aktivitäten" landen die Meldungen der Konfis über das, was sie schon gemacht haben. Du siehst sie mit Datum und Foto und bestätigst oder lehnst ab — erst mit der Bestätigung zählen die Punkte. Beim Ablehnen gehört eine Begründung dazu.',
};

export const slidesFuer = (rolle: 'konfi' | 'teamer' | 'admin' = 'konfi'): OnboardingSlide[] => [
  ...SLIDES_BASIS,
  rolle === 'konfi' ? SLIDE_AKTIVITAETEN_KONFI : SLIDE_AKTIVITAETEN_TEAM,
];

const MitmachenErklaerungModal: React.FC<MitmachenErklaerungModalProps> = ({
  onClose, displayName, rolle = 'konfi'
}) => <OnboardingTour slides={slidesFuer(rolle)} onClose={onClose} displayName={displayName} />;

export default MitmachenErklaerungModal;
