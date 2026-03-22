import React from 'react';
import SlideBase from './SlideBase';
import { useCountUp } from '../../../hooks/useCountUp';
import type { SlideProps, KonfiPunkteSlide } from '../../../types/wrapped';

interface PunkteSlideProps extends SlideProps {
  punkte: KonfiPunkteSlide;
}

const PunkteSlide: React.FC<PunkteSlideProps> = ({ isActive, punkte }) => {
  const animatedTotal = useCountUp(punkte.total, isActive, 2000);
  const animatedGottesdienst = useCountUp(punkte.gottesdienst, isActive, 1500);
  const animatedGemeinde = useCountUp(punkte.gemeinde, isActive, 1500);

  return (
    <SlideBase isActive={isActive} className="punkte-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Deine Punkte</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1">
        <p className="wrapped-big-number">{animatedTotal}</p>
        <p className="wrapped-subtitle">Punkte gesammelt</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2">
        <div className="punkte-split">
          <div className="punkte-split-item">
            <span className="punkte-split-value">{animatedGottesdienst}</span>
            <span className="punkte-split-label">Gottesdienst</span>
          </div>
          <div className="punkte-split-divider" />
          <div className="punkte-split-item">
            <span className="punkte-split-value">{animatedGemeinde}</span>
            <span className="punkte-split-label">Gemeinde</span>
          </div>
        </div>
      </div>
      {punkte.bonus > 0 && (
        <div className="wrapped-anim-fade wrapped-anim-delay-3">
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '16px' }}>
            davon {punkte.bonus} Bonuspunkte
          </p>
        </div>
      )}
    </SlideBase>
  );
};

export default PunkteSlide;
