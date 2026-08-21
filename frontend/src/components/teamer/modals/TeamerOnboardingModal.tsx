import React from 'react';
import {
  sparklesOutline, homeOutline, chatbubblesOutline, calendarOutline,
  ribbonOutline, folderOpenOutline, flagOutline, documentTextOutline,
} from 'ionicons/icons';
import OnboardingTour, { OnboardingSlide } from '../../shared/OnboardingTour';

interface TeamerOnboardingModalProps {
  onClose: () => void;
  displayName?: string;
}

// Teamer-Tour: folgt den Teamer-Tabs (Start · Chat · Events · Challenges ·
// Badges). Die Aktivitaeten sind seit dem Tab-Umbau ein Segment IM Events-Tab
// (kein eigener Tab mehr) und bekommen einen EIGENEN Slide direkt hinter den
// Events (User-Entscheid 10.08.) — im Events-Slide nur nebenbei erwaehnt ging
// unter, was Aktivitaeten ueberhaupt sind. Die Beispiele stammen aus den
// echten Teamer-Antraegen (Gottesdienst mitgestalten, Andacht, Schulung) —
// "Gottesdienstbesuch" waere die Konfi-Welt, nicht die des Teams.
const SLIDES: OnboardingSlide[] = [
  {
    icon: sparklesOutline,
    color: 'var(--app-color-teamer)',
    rgb: '--app-color-teamer-rgb',
    title: 'Willkommen im Team',
    text: 'Schön, dass du als Teamer:in dabei bist! Hier begleitest du deine Gruppe, behältst Termine im Blick und sammelst selbst Badges für dein Engagement. Wir zeigen dir kurz, wie alles funktioniert.',
  },
  {
    icon: homeOutline,
    color: 'var(--app-color-teamer)',
    rgb: '--app-color-teamer-rgb',
    title: 'Dein Start',
    text: 'Auf der Startseite siehst du deine wichtigsten Infos auf einen Blick: anstehende Termine, deine Badges, deine Zertifikate und alles, was für dich gerade ansteht.',
  },
  {
    icon: chatbubblesOutline,
    color: 'var(--app-color-chat)',
    rgb: '--app-color-chat-rgb',
    title: 'Dein Chat',
    text: 'Bleib mit deinem Jahrgang und dem Team in Kontakt — dafür gibt es automatische Chats. Du kannst auch Direktchats und Gruppenchats nutzen, und zu Events gibt es eigene Chats. Bilder teilen und Umfragen erstellen geht ebenfalls.',
  },
  {
    icon: calendarOutline,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Deine Events',
    text: 'Hier findest du alle Termine und meldest dich dort an, wo Teamer:innen gebraucht werden. Manche Termine sind nur fürs Team. Du kannst auch selbst Termine anlegen.',
  },
  {
    icon: documentTextOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Aktivitäten',
    text: 'Aktivitäten findest du oben im Events-Tab. Hast du einen Gottesdienst mitgestaltet, eine Andacht gehalten oder warst bei einer Teamer-Schulung? Dann reichst du das dort ein — so bleibt dein Einsatz dokumentiert und fließt in deine Badges ein.',
  },
  {
    icon: flagOutline,
    color: 'var(--app-color-challenges)',
    rgb: '--app-color-challenges-rgb',
    title: 'Challenges',
    text: 'Challenges begleiten die Konfis über einen Zeitraum, den du festlegst: Sie antworten mit Foto, Text, Aufnahme oder Link. Ohne Punkte, ohne Zähler, ohne Rangliste — nur ein Abzeichen fürs Mitmachen. Und das Wichtigste: Du machst mit. Teamer:innen und Leitung sind bei Challenges keine Zuschauer, sondern antworten selbst — es gibt sogar Runden nur fürs Team.',
  },
  {
    icon: ribbonOutline,
    color: 'var(--app-color-badges)',
    rgb: '--app-color-badges-rgb',
    title: 'Deine Badges',
    text: 'Auch du sammelst Abzeichen — für dein Engagement im Team. Schau hier, welche Badges du schon hast und welche du als Nächstes erreichen kannst.',
  },
  {
    icon: folderOpenOutline,
    color: 'var(--app-color-material)',
    rgb: '--app-color-material-rgb',
    title: 'Material',
    text: 'Im Material-Bereich findest du alle Unterlagen fürs Team — allgemein oder direkt einem Event zugeordnet. Diese Materialien sind nur für euch im Team sichtbar, nicht für die Konfis.',
  },
];

const TeamerOnboardingModal: React.FC<TeamerOnboardingModalProps> = ({ onClose, displayName }) => (
  <OnboardingTour slides={SLIDES} onClose={onClose} displayName={displayName} />
);

export default TeamerOnboardingModal;
