import React from 'react';
import SlideBase from '../SlideBase';
import type { SlideProps } from '../../../../types/wrapped';

interface TeamerIntroSlideProps extends SlideProps {
  displayName: string;
  year: number;
}

const TeamerIntroSlide: React.FC<TeamerIntroSlideProps> = ({ isActive, displayName, year }) => {
  return (
    <SlideBase isActive={isActive} className="teamer-intro-slide">
      <div className="wrapped-anim-fade">
        <p className="wrapped-subtitle">Willkommen zu deinem</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-1">
        <h1 className="wrapped-big-number" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>
          Teamer-Jahr {year}
        </h1>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2">
        <p className="wrapped-subtitle">{displayName}</p>
      </div>
    </SlideBase>
  );
};

export default TeamerIntroSlide;
