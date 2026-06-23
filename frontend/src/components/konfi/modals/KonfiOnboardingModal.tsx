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
// rgb = Name der -rgb-CSS-Variable (z.B. "konfis" -> --app-color-konfis-rgb),
// noetig fuer rgba()-Alphastufen im Gradient. `${color}d9` (Hex anhaengen)
// funktioniert NICHT mit var() -> ungueltiges CSS -> kein Hintergrund.
const SLIDES: { icon: string; color: string; rgb: string; title: string; text: string }[] = [
  {
    icon: sparklesOutline,
    color: 'var(--app-color-konfis)',
    rgb: '--app-color-konfis-rgb',
    title: 'Willkommen bei Konfi Quest!',
    text: 'Dein Abenteuer in der Gemeinde — moderne Konfi-Zeit für dich. Hier sammelst du Punkte, meldest dich zu Events an und bleibst mit deinem Jahrgang in Kontakt. Wir zeigen dir kurz, was dir Konfi Quest alles bietet.',
  },
  {
    icon: homeOutline,
    color: 'var(--app-color-konfis)',
    rgb: '--app-color-konfis-rgb',
    title: 'Start',
    text: 'Dein Überblick: deine Punkte, dein aktuelles Level und was als Nächstes ansteht. Hier landest du immer als Erstes.',
  },
  {
    icon: chatbubblesOutline,
    color: 'var(--app-color-chat)',
    rgb: '--app-color-chat-rgb',
    title: 'Chat',
    text: 'Schreib mit deinem Jahrgang und deinen Teamer:innen. Hier kommen auch wichtige Infos und Ankündigungen rein.',
  },
  {
    icon: calendarOutline,
    color: 'var(--app-color-events)',
    rgb: '--app-color-events-rgb',
    title: 'Events',
    text: 'Hier siehst du alle Termine und kannst dich direkt anmelden — bis hin zu deiner Konfirmation. Bei manchen Events gibt es Plätze oder Zeitfenster, einfach tippen und buchen.',
  },
  {
    icon: starOutline,
    color: 'var(--app-color-badges)',
    rgb: '--app-color-badges-rgb',
    title: 'Badges',
    text: 'Für deine Aktivitäten bekommst du Abzeichen. Sammle Badges und steig im Level auf — je mehr du machst, desto mehr schaltest du frei.',
  },
  {
    icon: documentTextOutline,
    color: 'var(--app-color-activities)',
    rgb: '--app-color-activities-rgb',
    title: 'Aktivitäten',
    text: 'Warst du im Gottesdienst, bei einer Taufe oder Hochzeit? Reiche deine Aktivitäten hier ein. Deine Gruppenleiterinnen bestätigen sie und du bekommst deine Punkte.',
  },
];

// Wechselnde Positionen fuer das grosse Ghost-Logo — eine je Slide, damit es
// ueber die Tour wandert (oben rechts, oben links, mittig, unten ...).
const ROSE_POSITIONS: React.CSSProperties[] = [
  { top: '-14vh', right: '-26vw', transform: 'rotate(-10deg)' },
  { top: '-16vh', left: '-28vw', transform: 'rotate(12deg)' },
  { top: '8vh', right: '-34vw', transform: 'rotate(6deg)' },
  { bottom: '-12vh', left: '-26vw', transform: 'rotate(-14deg)' },
  { bottom: '-10vh', right: '-28vw', transform: 'rotate(10deg)' },
  { top: '-10vh', left: '-18vw', transform: 'rotate(-6deg)' },
];

const KonfiOnboardingModal: React.FC<KonfiOnboardingModalProps> = ({ onClose, displayName }) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const next = useCallback(() => {
    if (isLast) { onClose(); return; }
    swiperRef.current?.slideNext();
  }, [isLast, onClose]);

  // Farbe der AKTUELLEN Slide -> als Modal-Hintergrund (IonContent). Robust
  // gegen die Swiper-Hoehenkette im Modal: der IonContent fuellt das Modal immer.
  // Alphastufen ueber rgba(var(--...-rgb), a) — NICHT ${color}d9 (Hex an var()
  // anhaengen ist ungueltiges CSS und liefert keinen Hintergrund -> weiss).
  const rgb = SLIDES[index].rgb;
  const activeGradient =
    `linear-gradient(165deg, rgb(var(${rgb})) 0%, rgba(var(${rgb}),0.85) 30%, rgba(var(${rgb}),0.5) 62%, rgba(var(${rgb}),0.12) 100%)`;
  return (
    <IonContent
      className="konfi-onboarding-content"
      style={{
        '--background': activeGradient,
        transition: 'none'
      } as React.CSSProperties}
    >
      <style>{`
        .konfi-onboarding-content .swiper,
        .konfi-onboarding-content .swiper-wrapper { height: 100%; }
        .konfi-onboarding-content .swiper-slide { height: 100%; display: flex; }
      `}</style>
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
          autoHeight={false}
          onSwiper={(s) => { swiperRef.current = s; }}
          onSlideChange={(s) => setIndex(s.activeIndex)}
          style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }}
        >
          {SLIDES.map((slide, i) => (
            <SwiperSlide
              key={i}
              style={{
                // Transparent: die Farbe kommt vom IonContent-Hintergrund (robust
                // gegen kollabierende Slide-Hoehe). Slide traegt nur den Inhalt.
                height: '100%', minHeight: '100%', alignSelf: 'stretch',
                background: 'transparent'
              }}
            >
              <div style={{
                position: 'relative', overflow: 'hidden', flex: 1, width: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', height: '100%', minHeight: '100%', padding: '24px 32px 56px', boxSizing: 'border-box'
              }}>
                {/* Grosses Ghost-Logo wie auf der Login-Seite — pro Slide an einer
                    ANDEREN Position (wechselt durch alle 6 Slides, nicht nur 2). */}
                <img
                  src="/assets/icon/logo-mark-white.png"
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    ...ROSE_POSITIONS[i % ROSE_POSITIONS.length],
                    width: '95vw', maxWidth: '460px', height: 'auto',
                    objectFit: 'contain', opacity: 0.16,
                    pointerEvents: 'none', zIndex: 0
                  }}
                />
                {/* Dekorative Bubbles (wie Login) — luftig, asymmetrisch */}
                <div className="app-auth-bubble" style={{ top: '12%', left: '-40px', width: '130px', height: '130px' }} />
                <div className="app-auth-bubble app-auth-bubble--soft" style={{ top: '26%', left: '40px', width: '42px', height: '42px' }} />
                <div className="app-auth-bubble" style={{ bottom: '8%', right: '-36px', width: '150px', height: '150px' }} />
                <div className="app-auth-bubble app-auth-bubble--soft" style={{ bottom: '20%', left: '30px', width: '54px', height: '54px' }} />
                <div style={{
                  position: 'relative', zIndex: 1,
                  width: '110px', height: '110px', borderRadius: '28px',
                  // Helle Kachel auf farbigem Grund, damit das Icon abhebt.
                  background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '28px', boxShadow: '0 10px 28px rgba(0,0,0,0.18)'
                }}>
                  <IonIcon icon={slide.icon} style={{ fontSize: '3.2rem', color: '#fff' }} />
                </div>
                <h1 style={{ position: 'relative', zIndex: 1, fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 12px', textShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>
                  {i === 0 && displayName ? `Hallo ${displayName}!` : slide.title}
                </h1>
                <p style={{ position: 'relative', zIndex: 1, fontSize: '1.02rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.95)', margin: 0, maxWidth: '340px', textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                  {slide.text}
                </p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Aktions-Button unten — weiss auf farbigem Grund, Schrift in Slide-Farbe.
            Alle Zustaende (activated/focused/hover) explizit gesetzt, sonst blitzt
            beim Antippen das Ionic-Default-Blau auf. */}
        <div style={{ padding: '8px 24px 28px' }}>
          <IonButton
            expand="block"
            onClick={next}
            style={{
              '--background': '#ffffff',
              '--background-activated': 'rgba(255,255,255,0.85)',
              '--background-focused': 'rgba(255,255,255,0.9)',
              '--background-hover': '#ffffff',
              '--color': SLIDES[index].color,
              '--ripple-color': SLIDES[index].color,
              '--box-shadow': '0 6px 18px rgba(0,0,0,0.18)',
              '--border-radius': '14px',
              height: '52px', fontWeight: 700
            }}
          >
            {isLast ? 'Los geht’s!' : 'Weiter'}
            <IonIcon slot="end" icon={isLast ? checkmarkCircle : arrowForward} />
          </IonButton>
        </div>
      </div>
    </IonContent>
  );
};

export default KonfiOnboardingModal;
