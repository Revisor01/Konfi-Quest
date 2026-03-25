import React from 'react';
import { IonIcon } from '@ionic/react';
import { heartOutline, peopleOutline, trophyOutline, calendarOutline, ribbonOutline } from 'ionicons/icons';
import type { SlideProps, KonfiWrappedData } from '../../../types/wrapped';
import SlideBase from './SlideBase';

interface AbschlussSlideProps extends SlideProps {
  data: KonfiWrappedData;
  year: number;
}

const AbschlussSlide: React.FC<AbschlussSlideProps> = ({ isActive, data, year }) => {
  const zeitraumEnde = data.slides.zeitraum?.ende;

  return (
    <SlideBase isActive={isActive} className="abschluss-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Dein Konfi-Jahr {year}</p>
        <p className="wrapped-subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
          auf einen Blick
        </p>
      </div>

      {/* Konfirmations-Countdown */}
      {zeitraumEnde && (
        <div className="wrapped-anim-fade wrapped-anim-delay-1" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            <IonIcon icon={calendarOutline} style={{ fontSize: '1.1rem' }} />
            <span>
              Konfirmation am {new Date(zeitraumEnde).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
        width: '100%',
        maxWidth: '340px',
      }}>
        {[
          { icon: trophyOutline, value: data.slides.punkte.total, label: 'Punkte' },
          { icon: calendarOutline, value: data.slides.events.total_attended, label: 'Events' },
          { icon: ribbonOutline, value: data.slides.badges.total_earned, label: 'Badges' },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
          }}>
            <IonIcon icon={stat.icon} style={{ fontSize: '1.3rem', color: '#a78bfa' }} />
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{stat.value}</span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="wrapped-anim-bounce wrapped-anim-delay-3" style={{ marginTop: '32px', textAlign: 'center' }}>
        <p className="wrapped-hero-text" style={{
          fontSize: 'clamp(1.3rem, 5vw, 2rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <IonIcon icon={heartOutline} style={{ fontSize: '1.5rem', color: '#f472b6' }} />
          Werde Teamer:in
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          <IonIcon icon={peopleOutline} style={{ fontSize: '1rem' }} />
          gestalte die naechste Generation mit
        </p>
      </div>
    </SlideBase>
  );
};

export default AbschlussSlide;
