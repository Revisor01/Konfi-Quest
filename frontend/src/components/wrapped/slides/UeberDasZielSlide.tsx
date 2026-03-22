import React from 'react';
import type { SlideProps, KonfiEndspurtSlide } from '../../../types/wrapped';
import { useCountUp } from '../../../hooks/useCountUp';
import SlideBase from './SlideBase';

interface UeberDasZielSlideProps extends SlideProps {
  endspurt: KonfiEndspurtSlide;
  titel?: string;
}

// 20 Konfetti-Farben (zyklisch)
const KONFETTI_FARBEN = ['#fbbf24', '#f59e0b', '#fcd34d', '#a78bfa', '#ffffff'];

const UeberDasZielSlide: React.FC<UeberDasZielSlideProps> = ({ isActive, endspurt, titel }) => {
  const ueberschuss = Math.max(0, endspurt.aktuell_total - endspurt.ziel_total);
  const animatedUeberschuss = useCountUp(ueberschuss, isActive);

  return (
    <SlideBase isActive={isActive} className="ueber-das-ziel-slide">
      <div className="konfetti-container">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="konfetti-piece"
            style={{ background: KONFETTI_FARBEN[i % KONFETTI_FARBEN.length] }}
          />
        ))}
      </div>
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-label">{titel || 'Geschafft!'}</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1" style={{ opacity: 0 }}>
        <p className="wrapped-big-number">+{animatedUeberschuss}</p>
        <p className="wrapped-subtitle">Punkte \u00fcber dem Ziel!</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
        <p style={{ color: 'rgba(252, 211, 77, 0.7)', fontSize: '0.9rem', marginTop: '16px' }}>
          {endspurt.aktuell_total} / {endspurt.ziel_total} Punkte
        </p>
      </div>
    </SlideBase>
  );
};

export default UeberDasZielSlide;
