import React from 'react';
import { IonIcon } from '@ionic/react';
import { trophyOutline, starOutline } from 'ionicons/icons';
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
        <IonIcon icon={trophyOutline} style={{ fontSize: '2.5rem', opacity: 0.7, color: '#a78bfa' }} />
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <p className="wrapped-label">Deine Punkte</p>
      </div>
      <div className="wrapped-anim-number-pop wrapped-anim-delay-1">
        <p className="wrapped-big-number" style={{ textShadow: '0 0 40px rgba(255,255,255,0.3)' }}>
          {animatedTotal}
        </p>
        <p className="wrapped-subtitle">Punkte gesammelt</p>
      </div>
      <div className="wrapped-anim-delay-2" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '24px' }}>
        <div className="wrapped-anim-fly-left wrapped-anim-delay-2">
          <div className="punkte-split-item">
            <span className="punkte-split-value">{animatedGottesdienst}</span>
            <span className="punkte-split-label">Gottesdienst</span>
          </div>
        </div>
        <div className="punkte-split-divider" />
        <div className="wrapped-anim-fly-right wrapped-anim-delay-2">
          <div className="punkte-split-item">
            <span className="punkte-split-value">{animatedGemeinde}</span>
            <span className="punkte-split-label">Gemeinde</span>
          </div>
        </div>
      </div>
      {punkte.bonus > 0 && (
        <div className="wrapped-anim-fade wrapped-anim-delay-3">
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <IonIcon icon={starOutline} style={{ fontSize: '1.2rem', color: '#a78bfa' }} />
            davon {punkte.bonus} Bonuspunkte
          </p>
        </div>
      )}
    </SlideBase>
  );
};

export default PunkteSlide;
