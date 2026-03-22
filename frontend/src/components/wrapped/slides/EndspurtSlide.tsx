import React from 'react';
import type { SlideProps, KonfiEndspurtSlide } from '../../../types/wrapped';
import { useCountUp } from '../../../hooks/useCountUp';
import SlideBase from './SlideBase';

interface EndspurtSlideProps extends SlideProps {
  endspurt: KonfiEndspurtSlide;
}

const EndspurtSlide: React.FC<EndspurtSlideProps> = ({ isActive, endspurt }) => {
  const animatedFehlend = useCountUp(endspurt.fehlende_punkte, isActive);
  const progressPercent = Math.round((endspurt.aktuell_total / endspurt.ziel_total) * 100);

  return (
    <SlideBase isActive={isActive} className="endspurt-slide">
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-subtitle">Endspurt!</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1" style={{ opacity: 0 }}>
        <p className="wrapped-big-number">{animatedFehlend}</p>
        <p className="wrapped-subtitle">Punkte fehlen noch</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
        <div className="endspurt-progress">
          <div className="endspurt-progress-bar">
            <div
              className="endspurt-progress-fill"
              style={{ width: isActive ? `${progressPercent}%` : '0%' }}
            />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: '8px' }}>
            {endspurt.aktuell_total} von {endspurt.ziel_total} Punkten
          </p>
        </div>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-3" style={{ opacity: 0 }}>
        <p style={{ color: '#a78bfa', fontSize: '1.1rem', fontWeight: 600, marginTop: '24px' }}>
          Du schaffst das!
        </p>
      </div>
    </SlideBase>
  );
};

export default EndspurtSlide;
