import React from 'react';
import type { SlideProps, KonfiWrappedData } from '../../../types/wrapped';
import SlideBase from './SlideBase';

interface AbschlussSlideProps extends SlideProps {
  data: KonfiWrappedData;
  year: number;
}

const AbschlussSlide: React.FC<AbschlussSlideProps> = ({ isActive, data, year }) => {
  return (
    <SlideBase isActive={isActive} className="abschluss-slide">
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-subtitle">Dein Konfi-Jahr {year}</p>
        <p className="wrapped-subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
          auf einen Blick
        </p>
      </div>
      <div className="abschluss-summary wrapped-anim-fade wrapped-anim-delay-1" style={{ opacity: 0 }}>
        <div className="abschluss-stat">
          <span className="abschluss-stat-value">{data.slides.punkte.total}</span>
          <span className="abschluss-stat-label">Punkte</span>
        </div>
        <div className="abschluss-stat">
          <span className="abschluss-stat-value">{data.slides.events.total_attended}</span>
          <span className="abschluss-stat-label">Events</span>
        </div>
        <div className="abschluss-stat">
          <span className="abschluss-stat-value">{data.slides.badges.total_earned}</span>
          <span className="abschluss-stat-label">Badges</span>
        </div>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
        <div className="abschluss-cta">
          <p style={{ color: '#a78bfa', fontSize: '1.1rem', fontWeight: 600 }}>
            Mach weiter so!
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '8px' }}>
            Werde Teamer:in und gestalte die n&auml;chste Generation mit
          </p>
        </div>
      </div>
    </SlideBase>
  );
};

export default AbschlussSlide;
