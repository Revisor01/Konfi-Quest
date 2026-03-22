import React from 'react';
import SlideBase from '../SlideBase';
import type { SlideProps, TeamerWrappedData } from '../../../../types/wrapped';

interface TeamerAbschlussSlideProps extends SlideProps {
  data: TeamerWrappedData;
  year: number;
}

const TeamerAbschlussSlide: React.FC<TeamerAbschlussSlideProps> = ({ isActive, data, year }) => {
  return (
    <SlideBase isActive={isActive} className="teamer-abschluss-slide">
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-subtitle">Dein Teamer-Jahr {year}</p>
        <p className="wrapped-subtitle" style={{ color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
          auf einen Blick
        </p>
      </div>
      <div className="teamer-abschluss-summary wrapped-anim-fade wrapped-anim-delay-1" style={{ opacity: 0 }}>
        <div className="abschluss-stat">
          <span className="teamer-abschluss-stat-value">{data.slides.events_geleitet.total}</span>
          <span className="abschluss-stat-label">Events geleitet</span>
        </div>
        <div className="abschluss-stat">
          <span className="teamer-abschluss-stat-value">{data.slides.konfis_betreut.total_konfis}</span>
          <span className="abschluss-stat-label">Konfis betreut</span>
        </div>
        <div className="abschluss-stat">
          <span className="teamer-abschluss-stat-value">{data.slides.badges.total_earned}</span>
          <span className="abschluss-stat-label">Badges</span>
        </div>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
        <div className="abschluss-cta">
          <p style={{ color: '#fb7185', fontSize: '1.1rem', fontWeight: 600 }}>
            Danke f&uuml;r deinen Einsatz!
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '8px' }}>
            Du machst den Unterschied
          </p>
        </div>
      </div>
    </SlideBase>
  );
};

export default TeamerAbschlussSlide;
