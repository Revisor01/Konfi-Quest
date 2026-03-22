import React from 'react';
import SlideBase from '../SlideBase';
import { useCountUp } from '../../../../hooks/useCountUp';
import type { SlideProps, TeamerKonfisBetreutSlide } from '../../../../types/wrapped';

interface TeamerKonfisSlideProps extends SlideProps {
  konfis: TeamerKonfisBetreutSlide;
}

const TeamerKonfisSlide: React.FC<TeamerKonfisSlideProps> = ({ isActive, konfis }) => {
  const animatedCount = useCountUp(konfis.total_konfis, isActive);

  return (
    <SlideBase isActive={isActive} className="teamer-konfis-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Deine Konfis</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1">
        <p className="wrapped-big-number">{animatedCount}</p>
        <p className="wrapped-subtitle">Konfis betreut</p>
      </div>
      {konfis.jahrgaenge.length > 0 && (
        <div className="teamer-konfis-tags wrapped-anim-fade wrapped-anim-delay-2">
          {konfis.jahrgaenge.map((jg, i) => (
            <span key={i} className="teamer-konfis-tag">{jg}</span>
          ))}
        </div>
      )}
    </SlideBase>
  );
};

export default TeamerKonfisSlide;
