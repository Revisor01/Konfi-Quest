import React, { useRef, useState, useCallback } from 'react';
import { IonContent, IonButton, IonIcon } from '@ionic/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import {
  sparklesOutline, homeOutline, chatbubblesOutline, calendarOutline,
  starOutline, documentTextOutline, arrowForward, checkmarkCircle
} from 'ionicons/icons';
import 'swiper/css';
import 'swiper/css/pagination';

interface KonfiOnboardingModalProps {
  onClose: () => void;
  displayName?: string;
}

// Inhalt der Tab-Tour. Reihenfolge folgt den Konfi-Tabs:
// Start (Dashboard) · Chat · Events · Badges · Aktivitaeten.
const SLIDES: { icon: string; color: string; title: string; text: string }[] = [
  {
    icon: sparklesOutline,
    color: 'var(--app-color-konfis)',
    title: 'Willkommen bei Konfi Quest!',
    text: 'Hier sammelst du Punkte, meldest dich zu Events an und bleibst mit deinem Jahrgang in Kontakt. Wir zeigen dir kurz, was die Tabs unten machen.',
  },
  {
    icon: homeOutline,
    color: 'var(--app-color-konfis)',
    title: 'Start',
    text: 'Dein Überblick: deine Punkte, dein aktuelles Level und was als Nächstes ansteht. Hier landest du immer als Erstes.',
  },
  {
    icon: chatbubblesOutline,
    color: 'var(--app-color-chat)',
    title: 'Chat',
    text: 'Schreib mit deinem Jahrgang und deinen Teamer:innen. Hier kommen auch wichtige Infos und Ankündigungen rein.',
  },
  {
    icon: calendarOutline,
    color: 'var(--app-color-events)',
    title: 'Events',
    text: 'Hier siehst du alle Termine und kannst dich direkt anmelden. Bei manchen Events gibt es Plätze oder Zeitfenster — einfach tippen und buchen.',
  },
  {
    icon: starOutline,
    color: 'var(--app-color-level)',
    title: 'Badges',
    text: 'Für deine Aktivitäten bekommst du Abzeichen. Sammle Badges und steig im Level auf — je mehr du machst, desto mehr schaltest du frei.',
  },
  {
    icon: documentTextOutline,
    color: 'var(--app-color-activities)',
    title: 'Aktivitäten',
    text: 'Hast du etwas gemacht — z.B. einen Gottesdienst besucht? Reiche es hier ein. Deine Teamer:innen bestätigen es und du bekommst deine Punkte.',
  },
];

const KonfiOnboardingModal: React.FC<KonfiOnboardingModalProps> = ({ onClose, displayName }) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const next = useCallback(() => {
    if (isLast) { onClose(); return; }
    swiperRef.current?.slideNext();
  }, [isLast, onClose]);

  return (
    <IonContent className="app-gradient-background">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
        {/* Skip oben rechts (nicht auf der letzten Slide) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          {!isLast && (
            <IonButton fill="clear" size="small" onClick={onClose} style={{ '--color': '#8e8e93' }}>
              Überspringen
            </IonButton>
          )}
        </div>

        <Swiper
          modules={[Pagination]}
          pagination={{ clickable: true }}
          onSwiper={(s) => { swiperRef.current = s; }}
          onSlideChange={(s) => setIndex(s.activeIndex)}
          style={{ flex: 1, width: '100%' }}
        >
          {SLIDES.map((slide, i) => (
            <SwiperSlide key={i}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', height: '100%', padding: '24px 32px 56px', boxSizing: 'border-box'
              }}>
                <div style={{
                  width: '110px', height: '110px', borderRadius: '28px',
                  background: slide.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '28px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                }}>
                  <IonIcon icon={slide.icon} style={{ fontSize: '3.2rem', color: '#fff' }} />
                </div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px' }}>
                  {i === 0 && displayName ? `Hallo ${displayName}!` : slide.title}
                </h1>
                <p style={{ fontSize: '1.02rem', lineHeight: 1.5, color: '#555', margin: 0, maxWidth: '340px' }}>
                  {slide.text}
                </p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Aktions-Button unten */}
        <div style={{ padding: '8px 24px 28px' }}>
          <IonButton expand="block" onClick={next} style={{ '--background': 'var(--app-color-konfis)', '--border-radius': '14px', height: '52px', fontWeight: 700 }}>
            {isLast ? 'Los geht’s!' : 'Weiter'}
            <IonIcon slot="end" icon={isLast ? checkmarkCircle : arrowForward} />
          </IonButton>
        </div>
      </div>
    </IonContent>
  );
};

export default KonfiOnboardingModal;
